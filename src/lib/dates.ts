/**
 * Asia/Karachi date handling.
 *
 * Staff enter calendar dates in Pakistan time; PostgreSQL stores UTC instants.
 * Pakistan Standard Time is a fixed UTC+05:00 (no DST since 2009), so the
 * conversion is a fixed offset. Keep all conversions in this module.
 */
export const KARACHI_TZ = 'Asia/Karachi';
const OFFSET = '+05:00';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(d: string): boolean {
  if (!DATE_RE.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

function addDays(d: string, days: number): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

/** "Show from" date → UTC instant of that day's 00:00 in Karachi. */
export function startOfKarachiDayUtc(date: string): string | null {
  if (!isValidDate(date)) return null;
  return new Date(`${date}T00:00:00${OFFSET}`).toISOString();
}

/**
 * "Valid through" date (inclusive, Karachi) → exclusive UTC expiry at the
 * following Karachi midnight. e.g. 2026-10-31 → 2026-10-31T19:00:00.000Z.
 */
export function validThroughToExpiryUtc(date: string): string | null {
  if (!isValidDate(date)) return null;
  return new Date(`${addDays(date, 1)}T00:00:00${OFFSET}`).toISOString();
}

/** Karachi calendar date (YYYY-MM-DD) of a UTC instant. */
export function karachiDate(iso: string): string {
  const t = new Date(iso);
  const shifted = new Date(t.getTime() + 5 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

/** Inverse of validThroughToExpiryUtc: exclusive expiry → last valid Karachi date. */
export function expiryUtcToValidThrough(iso: string): string {
  return addDays(karachiDate(iso), -1);
}

/** Today's date in Karachi. */
export function karachiToday(now: Date = new Date()): string {
  return karachiDate(now.toISOString());
}

/** Active rule shared by UI checks; the database applies the same rule with now(). */
export function isActive(
  p: { status?: string; starts_at: string | null; expires_at: string | null },
  now: Date = new Date(),
): boolean {
  if (p.status !== undefined && p.status !== 'published') return false;
  const t = now.getTime();
  if (p.starts_at && new Date(p.starts_at).getTime() > t) return false;
  if (p.expires_at && new Date(p.expires_at).getTime() <= t) return false;
  return true;
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: KARACHI_TZ,
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** Format a plain calendar date (YYYY-MM-DD) without timezone shifts. */
export function formatCalendarDate(date: string): string {
  if (!isValidDate(date)) return date;
  // Noon Karachi keeps the calendar day stable in the formatter.
  return dateFmt.format(new Date(`${date}T12:00:00${OFFSET}`));
}

/** "Valid until 31 October 2026" text for an exclusive expiry instant. */
export function formatValidThrough(expiresAt: string): string {
  return formatCalendarDate(expiryUtcToValidThrough(expiresAt));
}
