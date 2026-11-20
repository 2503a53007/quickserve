/**
 * Central, typed access to environment variables.
 * - NEXT_PUBLIC_* values must be referenced literally so Next can inline them.
 * - Server-only secrets are read lazily and NEVER imported by client components.
 */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  googleMapsKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? '',
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '',
  },
};

export const isSupabaseConfigured = () =>
  Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey && !publicEnv.supabaseUrl.includes('your-project'));
export const isMapsConfigured = () => Boolean(publicEnv.googleMapsKey);
export const isRazorpayConfigured = () => Boolean(publicEnv.razorpayKeyId && process.env.RAZORPAY_KEY_SECRET);
export const isFirebaseClientConfigured = () =>
  Boolean(publicEnv.firebase.apiKey && publicEnv.firebase.projectId && publicEnv.firebase.appId && publicEnv.firebase.vapidKey);
export const isFcmServerConfigured = () => Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
export const isSmsConfigured = () => Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_TEMPLATE_ID);
export const isProduction = () => process.env.NODE_ENV === 'production';

/** Server-only: required secret or a clear error that tells the developer what to do. */
export function requireSecret(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required server environment variable ${name}. See .env.example (generate with: openssl rand -hex 32).`);
  return v;
}

export const serverEnv = {
  serviceRoleKey: () => requireSecret('SUPABASE_SERVICE_ROLE_KEY'),
  otpSecret: () => requireSecret('OTP_HMAC_SECRET'),
  otpEncryptionKey: () => requireSecret('OTP_ENCRYPTION_KEY'),
  razorpaySecret: () => requireSecret('RAZORPAY_KEY_SECRET'),
  razorpayWebhookSecret: () => requireSecret('RAZORPAY_WEBHOOK_SECRET'),
  googleMapsServerKey: () => process.env.GOOGLE_MAPS_SERVER_API_KEY ?? '',
};
