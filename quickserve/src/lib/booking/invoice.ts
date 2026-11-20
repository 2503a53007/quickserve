import 'server-only';
import type { AdminClient } from '@/lib/supabase/server';
import { toIstDateString } from '@/utils/time';
import type { FinalBill } from '@/lib/pricing';

/** Creates the immutable invoice snapshot for a completed booking (idempotent per booking). */
export async function createInvoice(admin: AdminClient, bookingId: string, bill: FinalBill) {
  const { data: existing } = await admin.from('invoices').select('*').eq('booking_id', bookingId).maybeSingle();
  if (existing) return existing;

  const { data: b } = await admin.from('bookings')
    .select('*, services(name,description), customer:users!bookings_customer_id_fkey(full_name,mobile,email), provider:provider_profiles(display_name, users(full_name)), company:company_profiles(company_name)')
    .eq('id', bookingId).single();
  if (!b) throw new Error('Booking not found for invoice');
  const x = b as any;
  const { data, error } = await admin.from('invoices').insert({
    booking_id: b.id, customer_id: b.customer_id, provider_id: b.provider_id, company_id: b.company_id,
    customer_name: x.customer?.full_name, customer_mobile: x.customer?.mobile, customer_email: x.customer?.email,
    customer_address: [b.address_line, b.address_city, b.address_state, b.address_pin].filter(Boolean).join(', '),
    provider_name: x.provider?.display_name ?? x.provider?.users?.full_name ?? null, company_name: x.company?.company_name ?? null,
    service_name: x.services?.name ?? 'Service', service_description: b.issue_description ?? x.services?.description ?? null,
    service_date: toIstDateString(new Date(b.started_at ?? b.scheduled_start)),
    start_time: b.started_at, end_time: b.completed_at,
    actual_hours: b.actual_hours, billed_hours: bill.billedHours, line_items: bill.lines,
    base_amount: bill.labor, material_cost: bill.materials, spare_parts_cost: bill.spareParts, visiting_charge: bill.visiting,
    discount_amount: bill.discount, tax_percent: bill.taxPercent, tax_amount: bill.tax, total_amount: bill.total,
    payment_status: 'pending', payment_method: b.payment_method,
  }).select('*').single();
  if (error) throw error;
  return data;
}
