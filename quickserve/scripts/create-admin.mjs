#!/usr/bin/env node
/**
 * Secure administrator creation script (run locally by platform owner only).
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/create-admin.mjs admin@quickserve.in StrongPass123! "Admin Name"
 */
import { createClient } from '@supabase/supabase-js';

const [email, password, fullName = 'QuickServe Admin'] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running.');
  process.exit(1);
}
if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> [fullName]');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: fullName },
});

if (error) {
  console.error('Failed to create auth user:', error.message);
  process.exit(1);
}

const { error: profileErr } = await supabase.from('users').upsert({
  id: data.user.id,
  role: 'admin',
  full_name: fullName,
  email,
  is_active: true,
  profile_completed: true,
});

if (profileErr) {
  console.error('Failed to promote user to admin:', profileErr.message);
  process.exit(1);
}

console.log(`✓ Admin account created for ${email} (id: ${data.user.id})`);
