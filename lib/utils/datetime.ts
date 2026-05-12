export const DEFAULT_TIMEZONE = 'UTC';

type DateInput = Date | string | null | undefined;

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

export function resolveTimezone(timezone?: string | null): string {
  const trimmed = typeof timezone === 'string' ? timezone.trim() : '';
  if (!trimmed) return DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function detectLocalTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return resolveTimezone(tz);
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

function parseDate(value: DateInput): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (!isValidDate(date)) return null;
  return date;
}

export function formatDateTime(
  value: DateInput,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {},
  locale?: string | string[],
): string {
  const date = parseDate(value);
  if (!date) return '—';
  const resolvedTimezone = resolveTimezone(timezone);
  const formatted = date.toLocaleString(locale, { ...options, timeZone: resolvedTimezone });
  return `${formatted} (${resolvedTimezone})`;
}

export function formatDate(
  value: DateInput,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {},
  locale?: string | string[],
): string {
  const date = parseDate(value);
  if (!date) return '—';
  const resolvedTimezone = resolveTimezone(timezone);
  const formatted = date.toLocaleDateString(locale, { ...options, timeZone: resolvedTimezone });
  return `${formatted} (${resolvedTimezone})`;
}

/**
 * Render today's calendar day as `YYYY-MM-DD` *as seen in* `timezone`.
 *
 * Use this for any default filter date in the UI — `new Date().toISOString().slice(0, 10)`
 * silently returns the UTC day, which shifts the analyst's "today" by
 * 5-12 hours near midnight. Pair with `detectLocalTimezone()`.
 */
export function formatLocalDate(value: DateInput, timezone: string): string {
  const date = parseDate(value);
  if (!date) return '—';
  const resolvedTimezone = resolveTimezone(timezone);
  // sv-SE gives ISO-formatted YYYY-MM-DD; explicit timeZone option pins the
  // calendar to the analyst's locale instead of the JS runtime's.
  return date.toLocaleDateString('sv-SE', { timeZone: resolvedTimezone });
}

/**
 * Convert a `YYYY-MM-DD` (local calendar day) to a full ISO-8601 datetime
 * at local midnight in `timezone`, e.g. `2026-05-11T00:00:00-05:00`.
 *
 * Send this to backend filter params (`created_at_from`,
 * `source_created_at_from`, etc.) so pydantic + `ensure_utc` materialize
 * the correct UTC instant — no `tz` query param needed for the filter
 * predicate.
 */
export function localMidnightIso(yyyyMmDd: string, timezone: string): string {
  if (!yyyyMmDd) return yyyyMmDd;
  const resolvedTimezone = resolveTimezone(timezone);
  // Compute the UTC offset of yyyyMmDd 12:00 local in `timezone`, then
  // build the ISO offset string. Using noon avoids DST-edge ambiguity.
  const noonLocal = new Date(`${yyyyMmDd}T12:00:00Z`);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: resolvedTimezone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
  });
  const parts = fmt.formatToParts(noonLocal);
  const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  // shortOffset emits values like "GMT-5", "GMT+8", "GMT" (UTC), "GMT-05:30"
  const match = tzPart.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  let offset = '+00:00';
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const sign = hours >= 0 ? '+' : '-';
    offset = `${sign}${String(Math.abs(hours)).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  return `${yyyyMmDd}T00:00:00${offset}`;
}

/**
 * Inclusive end-of-day ISO at 23:59:59 local in `timezone`. Pair with
 * `localMidnightIso` for `<= :end` SQL semantics.
 */
export function localEndOfDayIso(yyyyMmDd: string, timezone: string): string {
  const start = localMidnightIso(yyyyMmDd, timezone);
  // Replace the time portion only; the offset suffix is preserved.
  return start.replace('T00:00:00', 'T23:59:59');
}

/**
 * Render a date as a short relative phrase: "just now", "3m ago",
 * "5h ago", "2d ago", "3w ago", "5mo ago", "2y ago". Returns "—"
 * for null/invalid input. Always anchored to Date.now().
 */
export function formatRelative(value: DateInput): string {
  const date = parseDate(value);
  if (!date) return '—';
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.round(days / 365);
  return `${years}y ago`;
}
