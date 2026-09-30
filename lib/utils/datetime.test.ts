import { describe, expect, it, vi } from 'vitest';
import { formatTzBadge, localDateTimeToIso, localEndOfDayIso, localMidnightIso } from './datetime';

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

  it('uses the later instant for an inclusive end in the repeated hour', () => {
    expect(localDateTimeToIso('2026-11-01T01:30:00', 'America/New_York', 'later'))
      .toBe('2026-11-01T01:30:00-05:00');
  });

  it('moves a wall time skipped by spring-forward past the gap instead of throwing', () => {
    // Santiago skips 00:00-00:59 on 2026-09-06; ZoneInfo resolves it to 04:00Z too.
    expect(localMidnightIso('2026-09-06', 'America/Santiago')).toBe('2026-09-06T01:00:00-03:00');
    expect(localDateTimeToIso('2026-03-08T02:30', 'America/New_York')).toBe('2026-03-08T03:30:00-04:00');
    expect(localDateTimeToIso('2026-10-04T02:15:00', 'Australia/Lord_Howe')).toBe('2026-10-04T02:45:00+11:00');
  });

  it('rejects a skipped wall time only when asked to', () => {
    expect(() => localDateTimeToIso('2026-03-08T02:30:00', 'America/New_York', 'earlier', 'reject'))
      .toThrow(RangeError);
    expect(() => localDateTimeToIso('garbage', 'UTC', 'earlier', 'reject')).toThrow(RangeError);
  });

  it('keeps fractional seconds and returns unparseable input unchanged', () => {
    expect(localDateTimeToIso('2026-07-01T12:34:56.789', 'America/New_York'))
      .toBe('2026-07-01T12:34:56.789-04:00');
    expect(localDateTimeToIso('2026-07-01T12:3', 'UTC')).toBe('2026-07-01T12:3');
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
