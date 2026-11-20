# QuickServe — Full-Stack Local Service Finder & Booking Platform (All India)

**Tagline:** Your Services. Your Vibe.  
**Brand Message:** Book it. Track it. Done.  
**Theme:** QuickServe Orange & White Gen-Z Edition (`#F97316`, `#EA580C`, `#FFF1E8`, `#FFFFFF`, `#FFF7F2`) with Light & Dark Mode.

---

## Architecture Overview

QuickServe connects three portals to a unified Next.js App Router + Supabase PostgreSQL backend:

1. **Customer Portal (`/`, `/services`, `/booking`, `/tracking`, `/orders`, `/wishlist`, `/offers`, `/support`, `/profile`)**
   - All 19 service categories (44+ services) with transparent hourly & visiting charges
   - Browser GPS location detection, Indian PIN code & city search, nearby verified provider discovery & side-by-side comparison
   - Multi-step booking with problem photo uploads, booked hours selector (1–12 hrs), coupon codes, Zepto-style arrival ETA window, and Cash on Delivery / UPI (Razorpay)
   - Live GPS tracking map (automatically stops after service starts/completes for privacy), Start Service OTP & End Service OTP verification, mid-job Extra Hours approval
   - Automatic itemized GST tax invoice with **Download PDF**, **Copy Bill**, and **Share Invoice**
   - Verified post-completion reviews, cancellation & refund tracking, wishlist & 1-click rebooking, browser push notifications (FCM)
2. **Individual Provider & Registered Company Portals (`/provider`, `/provider/register`, `/company`, `/company/register`)**
   - KYC & Government ID verification, GSTIN & business registration, bank/UPI payout details
   - Online/Offline status toggle, Accept/Reject bookings, live GPS travel updates, Start/End OTP verification, extra-hour requests, material/spare parts billing, cash collection, employee/worker dispatch
3. **Admin Control Panel (`/admin`)**
   - Marketplace analytics KPIs, Provider & Company verification queue, Commission & Arrival SLA controls, Refund approval & Razorpay gateway refund processing, Coupons/Offers CRUD, Support Ticket responses, and Push Broadcasts.

---

## Complete MacBook (macOS) & VS Code Setup Guide

### 1. Install Homebrew & Node.js (v20+)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
brew install node@22
node -v
npm -v
```

### 2. Install VS Code
```bash
brew install --cask visual-studio-code
```
Install recommended extensions in VS Code: **ESLint**, **Tailwind CSS IntelliSense**, **Prettier**.

### 3. Install Git
```bash
brew install git
git --version
```

### 4. Open the QuickServe Project
```bash
cd /Users/sachinperumandla/.gemini/antigravity/scratch/quickserve
code .
```

### 5. Install Dependencies
```bash
npm install
```

### 6. Set Up Supabase (Database, Auth & Storage)
1. Create a free project at https://supabase.com.
2. Go to **Project Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose to client!)

### 7. Configure Supabase Authentication
In Supabase Dashboard → **Authentication → Providers**:
- Enable **Phone** (configure Twilio/MSG91 SMS provider for Indian OTP delivery).
- Enable **Email** (email + password login).
- Enable **Google** (add Google OAuth Client ID/Secret and set redirect URL to `http://localhost:3000`).

### 8. Run Database Migrations & Seed Reference Data
In Supabase Dashboard → **SQL Editor**, run the 5 migration files in order:
1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_rls.sql`
3. `supabase/migrations/003_functions.sql`
4. `supabase/migrations/004_seed.sql`
5. `supabase/migrations/005_storage.sql`

Verify migrations locally:
```bash
npm run db:check
```

### 9. Configure Google Maps API
1. Create a project in https://console.cloud.google.com.
2. Enable **Maps JavaScript API**, **Geocoding API**, and **Distance Matrix / Directions API**.
3. Create two keys:
   - Browser key (HTTP referrer restricted) → `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   - Server key (IP restricted) → `GOOGLE_MAPS_SERVER_API_KEY`

### 10. Configure Razorpay (Test Mode for UPI)
1. Create an account at https://dashboard.razorpay.com and switch to **Test Mode**.
2. Go to **Settings → API Keys → Generate Test Key**:
   - Key ID (`rzp_test_...`) → `NEXT_PUBLIC_RAZORPAY_KEY_ID`
   - Key Secret → `RAZORPAY_KEY_SECRET`
3. Go to **Settings → Webhooks**, add `https://<your-domain>/api/payments/razorpay/webhook` for `payment.captured` & `payment.failed`, and copy the secret to `RAZORPAY_WEBHOOK_SECRET`.

### 11. Configure Firebase Cloud Messaging (Browser Push Notifications)
1. Create a project at https://console.firebase.google.com and add a Web App.
2. Copy client config into `NEXT_PUBLIC_FIREBASE_*` and Web Push VAPID key into `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
3. Download a Service Account JSON from **Project Settings → Service Accounts** and set `FIREBASE_SERVICE_ACCOUNT_JSON`.

### 12. Set Up Environment Variables
```bash
cp .env.example .env.local
openssl rand -hex 32   # Paste into OTP_HMAC_SECRET
openssl rand -hex 32   # Paste into OTP_ENCRYPTION_KEY
```
Fill in your Supabase, Google Maps, Razorpay, Firebase, and MSG91 keys in `.env.local`.

### 13. Create Your First Admin Account (Secure CLI Only)
```bash
set -a && source .env.local && set +a
npm run admin:create -- admin@quickserve.in StrongAdminPass123! "QuickServe Admin"
```

### 14. Run the Development Server & Test Everything
```bash
npm run dev
```
Open http://localhost:3000 in your browser.

Run automated unit + PostgreSQL RLS/schema tests, typecheck, and production build:
```bash
npm test
npm run typecheck
npm run build
```

### 15. Deploy to Vercel
```bash
npm i -g vercel
vercel
```
Add all variables from `.env.local` in **Vercel Project Settings → Environment Variables**, update `NEXT_PUBLIC_APP_URL` to your production URL, and redeploy with `vercel --prod`.
