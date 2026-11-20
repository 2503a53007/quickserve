import { forbidden, notFound, ok, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { getLocalSessionUser, readLocalDb } from '@/lib/localDb';
import { getCustomerOtp } from '@/lib/otp';

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const db = readLocalDb();
    const booking = db.bookings.find((b) => b.id === id);
    if (!booking) throw notFound('Booking not found.');
    const otps = db.otps
      .filter((o) => o.bookingId === id && !o.verified && Date.now() < o.expiresAt)
      .map((o) => ({ purpose: o.purpose, code: o.code, expiresAt: new Date(o.expiresAt).toISOString() }));
    return ok({ booking, otps });
  }

  const ctx = await requireAuth();

  const { data: booking } = await ctx.admin
    .from('bookings')
    .select(
      '*, services(id, name, slug, description), service_categories(id, name, slug), provider:provider_profiles(id, display_name, avg_rating, total_jobs, user_id), company:company_profiles(id, company_name, avg_rating), booking_photos(*), booking_status_history(*), invoices(*), extra_hour_requests(*)',
    )
    .eq('id', id)
    .maybeSingle();

  if (!booking) throw notFound('Booking not found.');

  const isOwner =
    ctx.profile.role === 'admin' ||
    booking.customer_id === ctx.user.id ||
    (booking as any).provider?.user_id === ctx.user.id;
  if (!isOwner && ctx.profile.role === 'company') {
    const { data: comp } = await ctx.admin.from('company_profiles').select('id').eq('user_id', ctx.user.id).maybeSingle();
    if (!comp || booking.company_id !== comp.id) throw forbidden();
  } else if (!isOwner) {
    throw forbidden();
  }

  const otps = booking.customer_id === ctx.user.id ? await getCustomerOtp(ctx.admin, booking.id, ctx.user.id) : [];

  return ok({ booking, otps });
});
