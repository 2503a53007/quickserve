'use client';
import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/lib/env';

let client: ReturnType<typeof createBrowserClient> | null = null;

/** Browser Supabase client (anon key + user session; subject to RLS). */
export function createClient() {
  if (!client) client = createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
  return client;
}
