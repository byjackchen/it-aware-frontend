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
