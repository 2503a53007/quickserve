/** India has a single timezone (IST, UTC+05:30, no DST) — the whole platform schedules in IST. */
export const IST_OFFSET = '+05:30';
export const IST_MS = 5.5 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' + 'HH:MM' (IST) -> Date */
export const istToDate = (date: string, time: string) => new Date(`${date}T${time.length === 5 ? time : time.slice(0, 5)}:00${IST_OFFSET}`);
/** Date -> 'YYYY-MM-DD' in IST */
export const toIstDateString = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
/** Date -> 'HH:MM' in IST */
export const toIstTimeString = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(11, 16);
/** 0 = Sunday … 6 = Saturday, for an IST calendar date */
export const istDayOfWeek = (date: string) => new Date(`${date}T12:00:00${IST_OFFSET}`).getUTCDay(); // 12:00 IST = 06:30 UTC, same calendar day
export const addMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
export const minutesBetween = (a: Date, b: Date) => (b.getTime() - a.getTime()) / 60_000;
