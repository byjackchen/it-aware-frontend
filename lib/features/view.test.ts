import { expect, it } from 'vitest';
import {
  featureHref,
  named,
  parseFeaturesView,
} from '@/lib/features/view';

/** Manage Features' addresses and the small rules its screens show. */

it('builds and reads the addresses', () => {
  expect(featureHref()).toBe('/tasks/features');
  expect(featureHref('csat own')).toBe('/tasks/features?feature=csat%20own');
  expect(parseFeaturesView({ feature: 'f' })).toEqual({ feature: 'f' });
  expect(parseFeaturesView({ feature: ['g', 'h'] })).toEqual({ feature: 'g' });
  expect(parseFeaturesView({ feature: '' })).toEqual({ feature: null });
});

it('names by locale', () => {
  expect(named({ en: 'A', zh: '甲' }, 'zh')).toBe('甲');
  expect(named({ en: 'A', zh: '甲' }, 'en')).toBe('A');
});
