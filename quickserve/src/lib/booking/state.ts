import type { BookingStatus } from '@/types/db';

export const LIVE_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'provider_assigned', 'provider_travelling', 'provider_arrived', 'in_progress'];
export const TRACKABLE_STATUSES: BookingStatus[] = ['provider_travelling', 'provider_arrived', 'in_progress'];
export const TERMINAL_STATUSES: BookingStatus[] = ['completed', 'cancelled', 'rejected'];

const T: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'provider_assigned', 'rejected', 'cancelled'],
  confirmed: ['provider_assigned', 'cancelled'],
  provider_assigned: ['provider_travelling', 'confirmed', 'cancelled'],
  provider_travelling: ['provider_arrived', 'cancelled'],
  provider_arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  completed: [], cancelled: [], rejected: [],
};
export const canTransition = (from: BookingStatus, to: BookingStatus) => T[from].includes(to);

export type BookingAction =
  | 'accept' | 'reject' | 'assign' | 'start_travel' | 'arrived'
  | 'start_service' | 'request_end_otp' | 'end_service' | 'cancel'
  | 'request_extra_hours' | 'respond_extra_hours' | 'resend_start_otp';

export interface CancellationPolicy { free_before_minutes: number; late_fee: number; travelling_fee_uses_visiting_charge: boolean }
export const DEFAULT_CANCELLATION_POLICY: CancellationPolicy = { free_before_minutes: 60, late_fee: 50, travelling_fee_uses_visiting_charge: true };

/**
 * Customer cancellation fee (₹). Provider/admin cancellations are always free for the customer.
 *  - not yet assigned, or > free window before start ........ free
 *  - assigned but inside the free window ................... late fee
 *  - provider already travelling / arrived ................. visiting charge
 *  - in progress ........................................... cannot cancel
 */
export function cancellationFee(
  b: { status: BookingStatus; scheduled_start: string; visiting_charge: number },
  now: Date, policy: CancellationPolicy,
): { allowed: boolean; fee: number; reason?: string } {
  if (b.status === 'in_progress') return { allowed: false, fee: 0, reason: 'A service in progress cannot be cancelled. Please complete it with your provider.' };
  if (!LIVE_STATUSES.includes(b.status)) return { allowed: false, fee: 0, reason: 'This booking is already closed.' };
  if (b.status === 'provider_travelling' || b.status === 'provider_arrived') {
    return { allowed: true, fee: policy.travelling_fee_uses_visiting_charge ? Number(b.visiting_charge) : policy.late_fee };
  }
  if (b.status === 'pending' || b.status === 'confirmed') return { allowed: true, fee: 0 };
  const minutesToStart = (new Date(b.scheduled_start).getTime() - now.getTime()) / 60_000;
  return { allowed: true, fee: minutesToStart >= policy.free_before_minutes ? 0 : policy.late_fee };
}

/** Customer-facing progress steps for timelines. */
export const TIMELINE: { status: BookingStatus; label: string; timestampKey: string }[] = [
  { status: 'pending', label: 'Booking placed', timestampKey: 'created_at' },
  { status: 'confirmed', label: 'Booking confirmed', timestampKey: 'confirmed_at' },
  { status: 'provider_assigned', label: 'Provider assigned', timestampKey: 'assigned_at' },
  { status: 'provider_travelling', label: 'Provider on the way', timestampKey: 'travelling_at' },
  { status: 'provider_arrived', label: 'Provider arrived', timestampKey: 'arrived_at' },
  { status: 'in_progress', label: 'Service in progress', timestampKey: 'started_at' },
  { status: 'completed', label: 'Service completed', timestampKey: 'completed_at' },
];
