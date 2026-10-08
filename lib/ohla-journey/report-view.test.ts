import { describe, expect, it } from 'vitest';
import { catalogLabel, catalogText, gapTopicCounts, otherOutcomeCount, preferredTiming } from './report-view';

const catalog = {
  topics: [{ code: 'NET_CONNECTIVITY', name_en: 'Network › Network Issue', name_zh: '网络 › 网络问题' }],
  subtopics: [{ code: 'NET_CONNECTIVITY.office_wifi', name_en: 'Office Wi-Fi', name_zh: '办公室无线网络' }],
};

describe('Ohla report display values', () => {
  it('uses names from the uploaded catalog and keeps unknown codes visible', () => {
    expect(catalogLabel(catalog, 'topic', 'NET_CONNECTIVITY', true)).toBe('网络 › 网络问题');
    expect(catalogLabel(catalog, 'subtopic', 'NET_CONNECTIVITY.office_wifi', false)).toBe('Office Wi-Fi');
    expect(catalogLabel(catalog, 'topic', 'OTHER', true)).toBe('OTHER');
    expect(catalogText('topic=NET_CONNECTIVITY and NET_CONNECTIVITY.office_wifi', catalog, true))
      .toBe('topic=网络 › 网络问题 and 办公室无线网络');
  });

  it('matches the report residual outcome and first timing observation', () => {
    expect(otherOutcomeCount({ elsewhere: 4, unknown: 40, unresolved: 22, ai_confirmed: 100 })).toBe(66);
    expect(preferredTiming({ T5_calendar: { median_sec: 12600 }, T1_session: { median_sec: 32, n: 93 } }))
      .toEqual({ metric: 'T1', median_sec: 32, n: 93 });
    expect(preferredTiming({ T5_calendar: { median_sec: 12600 } })).toBeNull();
  });

  it('splits each gap topic by uploaded knowledge and action families', () => {
    expect(gapTopicCounts([
      { topic: 'A', gap_family: 'knowledge' }, { topic: 'A', gap_family: 'action' },
      { topic: 'A', gap_family: 'knowledge' }, { topic: 'B', gap_family: 'action' },
    ])).toEqual([
      { topic: 'A', knowledge: 2, action: 1, total: 3 },
      { topic: 'B', knowledge: 0, action: 1, total: 1 },
    ]);
  });
});
