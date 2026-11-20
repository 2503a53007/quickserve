import 'server-only';
import { audit, badRequest, conflict, notFound } from '@/lib/api';
import { notify } from '@/lib/notifications/server';
import { paise, razorpay, verifyCheckoutSignature } from '@/lib/payments/razorpay';
import type { AdminClient } from '@/lib/supabase/server';

type BookingRow = Record<string, any>;

/** Creates a Razorpay order for a completed booking and records a pending payment row. */
export async function createRazorpayOrderForBooking(admin: AdminClient, bookingId: string, customerId: string) {
  const { data: booking } = await admin.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (!booking) throw notFound('Booking not found.');
  if (booking.customer_id !== customerId) throw badRequest('This booking does not belong to you.');
  if (booking.status !== 'completed') throw conflict('Payment is collected after service completion.', 'INVALID_STATE');
  if (booking.payment_status === 'paid') throw conflict('This booking is already paid.', 'ALREADY_PAID');

  const amountRupees = Number(booking.final_total ?? booking.estimated_total ?? 0);
  if (amountRupees <= 0) throw badRequest('Invalid payable amount.');

  const amountPaise = paise(amountRupees);
  const client = razorpay();
  const order = await client.orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: booking.booking_code,
    notes: {
      booking_id: booking.id,
      booking_code: booking.booking_code,
      customer_id: customerId,
    },
  });

  const { data: payment, error } = await admin.from('payments').insert({
    booking_id: booking.id,
    customer_id: customerId,
    method: 'upi',
    status: 'pending',
    amount: amountRupees,
    currency: 'INR',
    razorpay_order_id: order.id,
    metadata: { receipt: order.receipt },
  }).select('*').single();

  if (error) throw error;
  return { order, payment, amountPaise, amountRupees };
}

/** Server-side verification of Razorpay checkout callback. Never trusts frontend status alone. */
export async function verifyAndCaptureRazorpayPayment(
  admin: AdminClient,
  input: {
    bookingId: string;
    customerId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
  ip?: string,
) {
  const valid = verifyCheckoutSignature(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature);
  if (!valid) throw badRequest('Payment signature verification failed.', 'INVALID_SIGNATURE');

  const { data: payment } = await admin
    .from('payments')
    .select('*')
    .eq('razorpay_order_id', input.razorpayOrderId)
    .eq('booking_id', input.bookingId)
    .maybeSingle();

  if (!payment) throw notFound('Payment record not found.');
  if (payment.status === 'paid') return { payment, alreadyCaptured: true };

  // Confirm with Razorpay API that payment is authorized/captured
  const rzpPayment = await razorpay().payments.fetch(input.razorpayPaymentId);
  if (!['captured', 'authorized'].includes(rzpPayment.status)) {
    await admin.from('payments').update({
      status: 'failed',
      razorpay_payment_id: input.razorpayPaymentId,
      failure_reason: `Gateway status: ${rzpPayment.status}`,
    }).eq('id', payment.id);
    throw badRequest(`Payment was not completed on Razorpay (status: ${rzpPayment.status}).`, 'PAYMENT_FAILED');
  }

  const now = new Date().toISOString();
  const { data: updatedPayment, error } = await admin.from('payments').update({
    status: 'paid',
    razorpay_payment_id: input.razorpayPaymentId,
    razorpay_signature: input.razorpaySignature,
    paid_at: now,
  }).eq('id', payment.id).select('*').single();
  if (error) throw error;

  await markBookingPaid(admin, input.bookingId, 'upi', input.customerId, ip);
  return { payment: updatedPayment, alreadyCaptured: false };
}

/** Provider marks cash payment collected after job completion. */
export async function recordCashPayment(admin: AdminClient, booking: BookingRow, actorId: string, ip?: string) {
  if (booking.payment_status === 'paid') throw conflict('This booking is already marked paid.', 'ALREADY_PAID');
  const amount = Number(booking.final_total ?? booking.estimated_total ?? 0);
  const now = new Date().toISOString();

  const { data: payment, error } = await admin.from('payments').insert({
    booking_id: booking.id,
    customer_id: booking.customer_id,
    method: 'cash',
    status: 'paid',
    amount,
    currency: 'INR',
    paid_at: now,
    metadata: { collected_by: actorId },
  }).select('*').single();
  if (error) throw error;

  await markBookingPaid(admin, booking.id, 'cash', actorId, ip);
  return payment;
}

/** Marks booking & invoice paid and credits provider/company payout queue. */
export async function markBookingPaid(
  admin: AdminClient,
  bookingId: string,
  method: 'cash' | 'upi',
  actorId?: string,
  ip?: string,
) {
  const { data: booking } = await admin.from('bookings').update({
    payment_status: 'paid',
    payment_method: method,
  }).eq('id', bookingId).select('*').single();

  if (!booking) return;

  await admin.from('invoices').update({
    payment_status: 'paid',
    payment_method: method,
  }).eq('booking_id', bookingId);

  // Create provider payout record for UPI/online collections
  if (method === 'upi' && Number(booking.provider_earning ?? 0) > 0) {
    await admin.from('provider_payouts').insert({
      booking_id: booking.id,
      provider_id: booking.provider_id,
      company_id: booking.company_id,
      gross_amount: Number(booking.final_total ?? 0),
      commission_amount: Number(booking.commission_amount ?? 0),
      net_amount: Number(booking.provider_earning ?? 0),
      status: 'pending',
    });
  }

  await notify(admin, {
    userIds: booking.customer_id,
    type: 'payment_received',
    title: 'Payment received ✅',
    body: `₹${Number(booking.final_total ?? booking.estimated_total ?? 0)} paid via ${method.toUpperCase()} for booking ${booking.booking_code}.`,
    data: { bookingId: booking.id, url: `/orders/${booking.id}` },
  });

  await audit(admin, {
    actorId: actorId ?? null,
    action: `payment.paid.${method}`,
    entity: 'booking',
    entityId: bookingId,
    ip,
    metadata: { amount: booking.final_total ?? booking.estimated_total },
  });
}

/** Processes a Razorpay refund after admin approval. */
export async function processRazorpayRefund(
  admin: AdminClient,
  refundId: string,
  adminUserId: string,
  ip?: string,
) {
  const { data: refund } = await admin.from('refunds').select('*, payments(*)').eq('id', refundId).maybeSingle();
  if (!refund) throw notFound('Refund request not found.');
  if (!['approved', 'processing'].includes(refund.status)) {
    throw conflict('Refund must be approved before processing.', 'INVALID_STATE');
  }

  const payment = (refund as any).payments;
  let gatewayRefundId: string | null = null;

  if (payment?.razorpay_payment_id) {
    const rzpRefund = await razorpay().payments.refund(payment.razorpay_payment_id, {
      amount: paise(Number(refund.amount)),
      notes: { refund_id: refund.id, booking_id: refund.booking_id },
    });
    gatewayRefundId = rzpRefund.id;
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await admin.from('refunds').update({
    status: 'completed',
    razorpay_refund_id: gatewayRefundId,
    processed_at: now,
    reviewed_by: adminUserId,
  }).eq('id', refundId).select('*').single();
  if (error) throw error;

  await admin.from('bookings').update({
    payment_status: 'refunded',
  }).eq('id', refund.booking_id);

  await notify(admin, {
    userIds: refund.customer_id,
    type: 'refund_update',
    title: 'Refund completed 💸',
    body: `Your refund of ₹${refund.amount} has been processed.${gatewayRefundId ? ` Ref: ${gatewayRefundId}` : ''}`,
    data: { bookingId: refund.booking_id, url: '/orders?tab=refunds' },
  });

  await audit(admin, {
    actorId: adminUserId,
    action: 'refund.completed',
    entity: 'refund',
    entityId: refundId,
    ip,
    metadata: { amount: refund.amount, gatewayRefundId },
  });

  return updated;
}

/** Handles verified Razorpay webhook payloads idempotently. */
export async function handleRazorpayWebhookEvent(admin: AdminClient, event: any) {
  const eventType = event?.event as string | undefined;
  const paymentEntity = event?.payload?.payment?.entity;
  if (!eventType || !paymentEntity) return { handled: false };

  const orderId = paymentEntity.order_id as string | undefined;
  const paymentId = paymentEntity.id as string | undefined;
  if (!orderId) return { handled: false };

  const { data: payment } = await admin.from('payments').select('*').eq('razorpay_order_id', orderId).maybeSingle();
  if (!payment) return { handled: false };

  if (eventType === 'payment.captured' && payment.status !== 'paid') {
    await admin.from('payments').update({
      status: 'paid',
      razorpay_payment_id: paymentId,
      paid_at: new Date().toISOString(),
    }).eq('id', payment.id);
    await markBookingPaid(admin, payment.booking_id, 'upi');
    return { handled: true, status: 'paid' };
  }

  if (eventType === 'payment.failed' && payment.status === 'pending') {
    await admin.from('payments').update({
      status: 'failed',
      razorpay_payment_id: paymentId,
      failure_reason: paymentEntity.error_description ?? 'Payment failed',
    }).eq('id', payment.id);
    return { handled: true, status: 'failed' };
  }

  return { handled: false };
}
