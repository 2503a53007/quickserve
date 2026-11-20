import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/payments/razorpay';
import { handleRazorpayWebhookEvent } from '@/lib/payments/service';
import { createAdminSupabase } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

export async function POST(req: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: { message: 'Server not configured' } }, { status: 503 });
    }
    const rawBody = await req.text();
    const sig = req.headers.get('x-razorpay-signature') ?? '';
    if (!sig || !verifyWebhookSignature(rawBody, sig)) {
      return NextResponse.json({ error: { message: 'Invalid webhook signature' } }, { status: 401 });
    }
    const payload = JSON.parse(rawBody);
    const admin = createAdminSupabase();
    const result = await handleRazorpayWebhookEvent(admin, payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[razorpay-webhook]', err);
    return NextResponse.json({ error: { message: 'Webhook processing failed' } }, { status: 500 });
  }
}
