const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function formatMonthLabel(month: string, locale: string): string {
  const match = MONTH_PATTERN.exec(month);
  if (!match) return month;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (locale === 'zh') return `${year}年${monthNumber}月`;
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function isValidMonthSelection(start: string, end: string): boolean {
  const startMatch = MONTH_PATTERN.exec(start);
  const endMatch = MONTH_PATTERN.exec(end);
  if (!startMatch || !endMatch) return false;
  if (Number(startMatch[1]) < 1 || Number(endMatch[1]) > 9998) return false;
  const startIndex = Number(startMatch[1]) * 12 + Number(startMatch[2]);
  const endIndex = Number(endMatch[1]) * 12 + Number(endMatch[2]);
  const months = endIndex - startIndex + 1;
  return months >= 1 && months <= 24;
}

/** Every `YYYY-MM` from `start` to `end`, inclusive; empty for an invalid selection. */
export function monthsBetween(start: string, end: string): string[] {
  if (!isValidMonthSelection(start, end)) return [];
  const first = Number(start.slice(0, 4)) * 12 + Number(start.slice(5, 7)) - 1;
  const last = Number(end.slice(0, 4)) * 12 + Number(end.slice(5, 7)) - 1;
  return Array.from({ length: last - first + 1 }, (_, offset) => {
    const index = first + offset;
    return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
  });
}

/** January through the current month of the current year, in `timezone`'s calendar. */
export function defaultMonthRange(now: Date, timezone: string): { start: string; end: string } {
  const end = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit' })
    .format(now)
    .slice(0, 7);
  return { start: `${end.slice(0, 4)}-01`, end };
}
