import { describe, expect, it } from 'vitest';
import { formatMonthLabel, isValidMonthSelection } from './survey-quality';

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
