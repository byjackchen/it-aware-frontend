import { describe, expect, it } from 'vitest';
import { formatMonthLabel, isValidMonthSelection, defaultMonthRange, monthsBetween } from './survey-quality';

describe('ServiceNow quality month selector', () => {
  it('formats selected months for Chinese and English', () => {
    expect(formatMonthLabel('2026-01', 'zh')).toBe('2026年1月');
    expect(formatMonthLabel('2026-01', 'en')).toBe('Jan 2026');
  });

  it('accepts an inclusive range of up to 24 months', () => {
    expect(isValidMonthSelection('2026-01', '2026-07')).toBe(true);
    expect(isValidMonthSelection('2025-01', '2026-12')).toBe(true);
  });

  it('rejects a reversed, malformed, or overly long range', () => {
    expect(isValidMonthSelection('2026-08', '2026-07')).toBe(false);
    expect(isValidMonthSelection('2026-00', '2026-07')).toBe(false);
    expect(isValidMonthSelection('2025-01', '2027-01')).toBe(false);
    expect(isValidMonthSelection('0000-01', '0000-02')).toBe(false);
    expect(isValidMonthSelection('9999-12', '9999-12')).toBe(false);
  });
});

describe('monthsBetween', () => {
  it('lists every month across a year boundary', () => {
    expect(monthsBetween('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('is empty for an invalid selection', () => {
    expect(monthsBetween('2026-08', '2026-07')).toEqual([]);
  });
});

describe('defaultMonthRange', () => {
  it('runs from January to the current month in the selected calendar', () => {
    const now = new Date('2026-10-01T02:00:00Z');
    expect(defaultMonthRange(now, 'UTC')).toEqual({ start: '2026-01', end: '2026-10' });
    expect(defaultMonthRange(now, 'America/Los_Angeles')).toEqual({ start: '2026-01', end: '2026-09' });
  });
});
