import 'server-only';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { isFcmServerConfigured, publicEnv } from '@/lib/env';
import type { AdminClient } from '@/lib/supabase/server';
import type { NotificationType } from '@/types/db';

let app: App | null = null;
function fcm() {
  if (!isFcmServerConfigured()) return null;
  if (!app) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON!;
    const json = JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
    app = getApps()[0] ?? initializeApp({ credential: cert(json) });
  }
  return getMessaging(app);
}

export interface NotifyInput {
  userIds: string | string[];
  type: NotificationType;
  title: string;
  body: string;
  /** Extra data for deep-linking, e.g. { bookingId, url } */
  data?: Record<string, string>;
}

/**
 * Stores an in-app notification (always) and sends a browser push (when FCM is configured).
 * Never throws — notification problems must not break a booking flow.
 */
export async function notify(admin: AdminClient, input: NotifyInput): Promise<void> {
  const userIds = Array.isArray(input.userIds) ? input.userIds : [input.userIds];
  if (!userIds.length) return;
  try {
    await admin.from('notifications').insert(userIds.map((user_id) => ({
      user_id, type: input.type, title: input.title, body: input.body, data: input.data ?? {},
    })));
    const messaging = fcm();
    if (!messaging) return;
    const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', userIds);
    if (!tokens?.length) return;
    const link = input.data?.url ? new URL(input.data.url, publicEnv.appUrl).toString() : publicEnv.appUrl;
    const res = await messaging.sendEachForMulticast({
      tokens: tokens.map((t) => t.token),
      notification: { title: input.title, body: input.body },
      data: { ...(input.data ?? {}), type: input.type, url: input.data?.url ?? '/' },
      webpush: { fcmOptions: { link }, notification: { icon: '/icons/icon.svg', badge: '/icons/icon.svg' } },
    });
    const dead: string[] = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') dead.push(tokens[i].token);
    });
    if (dead.length) await admin.from('push_tokens').delete().in('token', dead);
  } catch (e) {
    console.error('[notify] failed', (e as Error).message);
  }
}
