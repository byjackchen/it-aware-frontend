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
  return localDateTimeToIso(`${yyyyMmDd}T00:00:00`, timezone);
}

function offsetAt(instant: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
  });
  const parts = fmt.formatToParts(instant);
  const tzPart = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const match = tzPart.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  return hours * 60 + Math.sign(hours) * minutes;
}

/**
 * Inclusive end-of-day ISO at 23:59:59 local in `timezone`. Pair with
 * `localMidnightIso` for `<= :end` SQL semantics.
 */
export function localEndOfDayIso(yyyyMmDd: string, timezone: string): string {
  if (!yyyyMmDd) return yyyyMmDd;
  return localDateTimeToIso(`${yyyyMmDd}T23:59:59`, timezone);
}

/**
 * Render a Date as the local-zone `YYYY-MM-DDTHH:MM:SS` string used by
 * `<input type="datetime-local">`. The control needs naked wall-clock
 * components without trailing offset — the offset is added back at
 * submission time via {@link localDateTimeToIso}.
 */
export function formatLocalDateTime(value: DateInput, timezone: string): string {
  const date = parseDate(value);
  if (!date) return '';
  const resolvedTimezone = resolveTimezone(timezone);
  // sv-SE emits YYYY-MM-DD HH:MM:SS; swap the space for a 'T' to match
  // the format the browser's datetime-local input consumes.
  const formatted = date.toLocaleString('sv-SE', {
    timeZone: resolvedTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatted.replace(' ', 'T');
}

/**
 * Take a local `YYYY-MM-DDTHH:MM[:SS]` value out of a datetime-local
 * input and return a full ISO-8601 datetime with the timezone's offset
 * appended, e.g. `2026-05-11T13:45:00-05:00`. The wire format every
 * datetime backend filter accepts (pydantic + ensure_utc normalize the
 * offset to UTC server-side).
 */
export function localDateTimeToIso(localDateTime: string, timezone: string): string {
  if (!localDateTime) return localDateTime;
  // Normalize the local input to YYYY-MM-DDTHH:MM:SS (some inputs emit
  // without seconds when step=60).
  const datePart = localDateTime.slice(0, 10);
  let timePart = localDateTime.slice(11);
  if (/^\d{2}:\d{2}$/.test(timePart)) timePart = `${timePart}:00`;
  const wallTime = `${datePart}T${timePart}`;
  const zone = resolveTimezone(timezone);
  const wallUtc = Date.parse(`${wallTime}Z`);
  if (!Number.isFinite(wallUtc)) throw new RangeError(`Invalid local datetime: ${wallTime}`);
  const offsets = new Set([-1, 0, 1].map((days) => offsetAt(new Date(wallUtc + days * 86400000), zone)));
  const instants = [...offsets]
    .map((minutes) => wallUtc - minutes * 60000)
    .filter((instant) => formatLocalDateTime(new Date(instant), zone) === wallTime)
    .sort((a, b) => a - b);
  if (!instants.length) throw new RangeError(`Nonexistent local datetime: ${wallTime} (${zone})`);
  const minutes = offsetAt(new Date(instants[0]), zone);
  const sign = minutes >= 0 ? '+' : '-';
  const magnitude = Math.abs(minutes);
  return `${wallTime}${sign}${String(Math.floor(magnitude / 60)).padStart(2, '0')}:${String(magnitude % 60).padStart(2, '0')}`;
}

/**
 * Human-readable timezone badge string for the filter UI, e.g.
 * "America/Chicago (GMT-05:00)". Used next to datetime-local inputs.
 */
export function formatTzBadge(timezone: string): string {
  const resolvedTimezone = resolveTimezone(timezone);
  const minutes = offsetAt(new Date(), resolvedTimezone);
  const sign = minutes >= 0 ? '+' : '-';
  const magnitude = Math.abs(minutes);
  const offset = `${sign}${String(Math.floor(magnitude / 60)).padStart(2, '0')}:${String(magnitude % 60).padStart(2, '0')}`;
  return `${resolvedTimezone} (GMT${offset})`;
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
