import { badRequest, clientIp, ok, parseBody, route, unauthorized } from '@/lib/api';
import { requireAuth } from '@/lib/auth/session';
import { actionSchema, performBookingAction } from '@/lib/booking/actions';
import { isSupabaseConfigured } from '@/lib/env';
import { getLocalSessionUser, performLocalBookingAction } from '@/lib/localDb';

export const POST = route<{ id: string }>(async (req, { params }) => {
  const { id } = await params;

  if (!isSupabaseConfigured()) {
    const user = await getLocalSessionUser();
    if (!user) throw unauthorized();
    const input = await parseBody(req, actionSchema);
    try {
      const booking = performLocalBookingAction(user, id, input);
      return ok(booking);
    } catch (e) {
      throw badRequest(e instanceof Error ? e.message : 'Action failed');
    }
  }

  const ctx = await requireAuth();
  const input = await parseBody(req, actionSchema);
  const booking = await performBookingAction(ctx, id, input, clientIp(req));
  return ok(booking);
});
