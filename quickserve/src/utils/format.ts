import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const formatINR = (n: number | string | null | undefined) => inr.format(Number(n ?? 0));

const IST = 'Asia/Kolkata';
export const formatDate = (d: string | Date) => new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST }).format(new Date(d));
export const formatTime = (d: string | Date) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: IST }).format(new Date(d)).toUpperCase();
export const formatDateTime = (d: string | Date) => `${formatDate(d)}, ${formatTime(d)}`;
export const formatDistance = (km: number | null | undefined) => (km == null ? '—' : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);
export const formatDuration = (minutes: number) => {
  const m = Math.max(0, Math.round(minutes));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
};
export const formatHours = (h: number) => `${h} ${h === 1 ? 'hour' : 'hours'}`;
export const maskMobile = (m?: string | null) => (m ? `${m.slice(0, 3)}••••••${m.slice(-2)}` : '');
export const initials = (name?: string | null) => (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || '?';

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending: 'Awaiting provider', confirmed: 'Confirmed', provider_assigned: 'Provider assigned',
  provider_travelling: 'On the way', provider_arrived: 'Arrived', in_progress: 'In progress',
  completed: 'Completed', cancelled: 'Cancelled', rejected: 'Declined',
};
