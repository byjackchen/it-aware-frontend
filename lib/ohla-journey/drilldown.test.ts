import { describe, expect, it } from 'vitest';
import { buildJourneyTimeline, loadJourneyUnits } from './drilldown';

describe('Journey drill-down chronology', () => {
  it('keeps requests together by unit and places joining evidence between units', () => {
    const requests = [
      { request_id: 'r2', unit_id: 'ticket-1', at: '2026-04-02T10:00:00+08:00' },
      { request_id: 'r1', unit_id: 'segment-1', at: '2026-04-01T09:00:00+08:00' },
      { request_id: 'r3', unit_id: 'ticket-1', at: '2026-04-02T11:00:00+08:00' },
    ];
    const steps = buildJourneyTimeline(requests, {
      'segment-1': { type: 'segment', human_actions: [] },
      'ticket-1': { type: 'ticket', human_actions: ['password_reset'] },
    }, [['segment-1', 'ticket-1', 'creation_source', 'confirmed', 'ticket notice']]);
    expect(steps.map((step) => step.unitId)).toEqual(['segment-1', 'ticket-1']);
    expect(steps[1].requests.map((request) => request.request_id)).toEqual(['r2', 'r3']);
    expect(steps[1].gapSeconds).toBe(90000);
    expect(steps[1].joiningLinks).toEqual([['segment-1', 'ticket-1', 'creation_source', 'confirmed', 'ticket notice']]);
    expect(steps[1].unit.type).toBe('ticket');
  });

  it('does not invent a gap or evidence for the first unit', () => {
    expect(buildJourneyTimeline([{ unit_id: 'only', at: '2026-04-01T09:00:00+08:00' }], {}, [])[0])
      .toMatchObject({ unitId: 'only', gapSeconds: null, joiningLinks: [] });
  });
});

describe('Journey unit detail loading', () => {
  it('limits concurrent requests and reports failed units without hiding them', async () => {
    let active = 0;
    let peak = 0;
    const pending: Array<() => void> = [];
    const result = loadJourneyUnits(['a', 'b', 'c', 'd', 'b'], async (id) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => pending.push(resolve));
      active -= 1;
      if (id === 'c') throw new Error('temporary failure');
      return { unit_id: id };
    }, 2);

    expect(active).toBe(2);
    while (pending.length) {
      pending.shift()?.();
      await Promise.resolve();
      await Promise.resolve();
    }
    const loaded = await result;
    expect(peak).toBe(2);
    expect(loaded.units).toEqual({ a: { unit_id: 'a' }, b: { unit_id: 'b' }, d: { unit_id: 'd' } });
    expect(loaded.failedIds).toEqual(['c']);
  });
});
