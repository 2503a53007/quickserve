import { addMinutes, istDayOfWeek, istToDate, toIstTimeString } from '@/utils/time';

/** Time reserved after a job ends (wrap-up + travel to next job). */
export const SLOT_BUFFER_MINUTES = 30;
export const SLOT_STEP_MINUTES = 30;
export const DEFAULT_HOURS = { start: '09:00', end: '19:00', days: [1, 2, 3, 4, 5, 6] };

export interface WorkingWindow { start: string; end: string }
export interface BusyInterval { start: Date; end: Date }

/** A booking reserves [start, start + hours + buffer). */
export function reservedEnd(start: Date, hours: number): Date {
  return addMinutes(start, hours * 60 + SLOT_BUFFER_MINUTES);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Available start times for a date (IST), 30-min grid.
 * `capacity` = number of parallel workers (1 for an individual, N for a company).
 */
export function availableSlots(opts: {
  date: string;                    // YYYY-MM-DD (IST)
  hours: number;
  window: WorkingWindow | null;    // null => not working that day
  busy: BusyInterval[];
  capacity: number;
  now: Date;
  minLeadMinutes: number;
}): { time: string; startsAt: string }[] {
  const { date, hours, window, busy, capacity, now, minLeadMinutes } = opts;
  if (!window || capacity < 1) return [];
  const open = istToDate(date, window.start);
  const close = istToDate(date, window.end);
  const earliest = addMinutes(now, minLeadMinutes);
  const out: { time: string; startsAt: string }[] = [];
  for (let t = open; addMinutes(t, hours * 60) <= close; t = addMinutes(t, SLOT_STEP_MINUTES)) {
    if (t < earliest) continue;
    const end = reservedEnd(t, hours);
    const concurrent = busy.filter((b) => overlaps(t, end, b.start, b.end)).length;
    if (concurrent < capacity) out.push({ time: toIstTimeString(t), startsAt: t.toISOString() });
  }
  return out;
}

export function windowFor(date: string, rows: { day_of_week: number; start_time: string; end_time: string; is_working: boolean }[] | null,
  fallback: { days: number[]; start: string; end: string } = DEFAULT_HOURS): WorkingWindow | null {
  const dow = istDayOfWeek(date);
  if (rows && rows.length) {
    const r = rows.find((x) => x.day_of_week === dow);
    return r && r.is_working ? { start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5) } : null;
  }
  return fallback.days.includes(dow) ? { start: fallback.start.slice(0, 5), end: fallback.end.slice(0, 5) } : null;
}
