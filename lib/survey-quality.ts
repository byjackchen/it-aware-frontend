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
