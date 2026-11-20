import { describe, expect, it, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const TEST_DB = path.join(process.cwd(), '.quickserve-test-db.json');
process.env.QUICKSERVE_LOCAL_DB_FILE = TEST_DB;

import {
  createLocalBooking,
  createLocalUser,
  issueLocalOtp,
  performLocalBookingAction,
  verifyLocalOtp,
  verifyPassword,
} from '@/lib/localDb';

afterAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('Local Dev Auth, OTP, Booking & Invoice Flow', () => {
  it('issues and verifies a 6-digit auth OTP with attempt checks', () => {
    const issued = issueLocalOtp({ key: '+917780555236', purpose: 'auth' });
    expect(issued.code).toMatch(/^\d{6}$/);

    const bad = verifyLocalOtp('+917780555236', 'auth', '000000');
    expect(bad.ok).toBe(false);

    const good = verifyLocalOtp('+917780555236', 'auth', issued.code);
    expect(good.ok).toBe(true);

    // Cannot reuse verified OTP
    const reuse = verifyLocalOtp('+917780555236', 'auth', issued.code);
    expect(reuse.ok).toBe(false);
  });

  it('creates a user with scrypt-hashed password and verifies login', () => {
    const user = createLocalUser({
      role: 'customer',
      full_name: 'Sachin Perumandla',
      email: 'sachin@example.com',
      mobile: '+917780555236',
      password: 'StrongPassword123',
    });
    expect(verifyPassword('StrongPassword123', user.password_hash)).toBe(true);
    expect(verifyPassword('WrongPass', user.password_hash)).toBe(false);

    // Full booking -> Start OTP -> End OTP -> Auto Invoice
    const booking = createLocalBooking(user, {
      serviceId: 'svc-fan-light',
      ownerKind: 'provider',
      ownerId: 'prov-ramesh-elec',
      mode: 'asap',
      hours: 2,
      addressLine: 'Flat 301, Madhapur',
      addressCity: 'Hyderabad',
      addressPin: '500081',
      paymentMethod: 'cash',
    });
    expect(booking.booking_code).toMatch(/^QS-/);
    expect(booking.estimated_total).toBeGreaterThan(0);

    const raw = JSON.parse(fs.readFileSync(TEST_DB, 'utf8'));
    const startOtp = raw.otps.find((o: any) => o.bookingId === booking.id && o.purpose === 'start_service');
    expect(startOtp?.code).toMatch(/^\d{6}$/);

    const started = performLocalBookingAction(user, booking.id, { action: 'start_service', otp: startOtp.code });
    expect(started.status).toBe('in_progress');

    const raw2 = JSON.parse(fs.readFileSync(TEST_DB, 'utf8'));
    const endOtp = raw2.otps.find((o: any) => o.bookingId === booking.id && o.purpose === 'end_service');
    expect(endOtp?.code).toMatch(/^\d{6}$/);

    const completed = performLocalBookingAction(user, booking.id, { action: 'end_service', otp: endOtp.code });
    expect(completed.status).toBe('completed');
    expect(completed.invoices.length).toBe(1);
    expect(completed.invoices[0].total_amount).toBeGreaterThan(0);
  });
});
