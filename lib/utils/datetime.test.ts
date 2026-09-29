import { describe, expect, it, vi } from 'vitest';
import { formatTzBadge, localDateTimeToIso, localEndOfDayIso } from './datetime';

describe('localDateTimeToIso', () => {
  it('uses the offset at the exact wall time on a DST transition day', () => {
    expect(localDateTimeToIso('2026-03-08T00:00:00', 'America/New_York'))
      .toBe('2026-03-08T00:00:00-05:00');
    expect(localDateTimeToIso('2026-03-08T23:59:59', 'America/New_York'))
      .toBe('2026-03-08T23:59:59-04:00');
  });

  it('uses the earlier instant for an ambiguous fall-back hour', () => {
    expect(localDateTimeToIso('2026-11-01T01:30:00', 'America/New_York'))
      .toBe('2026-11-01T01:30:00-04:00');
  });

  it('keeps an empty optional end date empty', () => {
    expect(localEndOfDayIso('', 'America/New_York')).toBe('');
  });
});

describe('formatTzBadge', () => {
  it('uses the current offset when a timezone skips local midnight', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));
      expect(formatTzBadge('America/Santiago')).toBe('America/Santiago (GMT-03:00)');
    } finally {
      vi.useRealTimers();
    }
  });
});
