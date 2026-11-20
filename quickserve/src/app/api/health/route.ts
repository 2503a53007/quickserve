import { ok, route } from '@/lib/api';
import {
  isFcmServerConfigured,
  isFirebaseClientConfigured,
  isMapsConfigured,
  isRazorpayConfigured,
  isSmsConfigured,
  isSupabaseConfigured,
} from '@/lib/env';

export const GET = route(async () => {
  return ok({
    status: 'ok',
    timestamp: new Date().toISOString(),
    integrations: {
      supabase: isSupabaseConfigured(),
      googleMaps: isMapsConfigured(),
      razorpay: isRazorpayConfigured(),
      firebaseClient: isFirebaseClientConfigured(),
      firebaseServer: isFcmServerConfigured(),
      sms: isSmsConfigured(),
    },
  });
});
