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
