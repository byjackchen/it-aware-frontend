import { expect, it } from 'vitest';
import {
  featureHref,
  migrationsHref,
  named,
  parseFeaturesView,
  parseMigrationsView,
} from '@/lib/features/view';

/** Manage Features' addresses and the small rules its screens show. */

it('builds and reads the addresses', () => {
  expect(featureHref()).toBe('/tasks/features/features');
  expect(featureHref('csat own')).toBe('/tasks/features/features?feature=csat%20own');
  expect(migrationsHref()).toBe('/tasks/features/migrations');
  expect(migrationsHref({ page: 1 })).toBe('/tasks/features/migrations');
  expect(migrationsHref({ page: 3 })).toBe('/tasks/features/migrations?page=3');
  expect(migrationsHref({ run: 'a/b' })).toBe('/tasks/features/migrations?run=a%2Fb');
  expect(parseFeaturesView({ feature: 'f' })).toEqual({ feature: 'f' });
  expect(parseFeaturesView({ feature: ['g', 'h'] })).toEqual({ feature: 'g' });
  expect(parseFeaturesView({ feature: '' })).toEqual({ feature: null });
  expect(parseMigrationsView({})).toEqual({ run: null, page: 1 });
  expect(parseMigrationsView({ page: '4', run: 'r' })).toEqual({ run: 'r', page: 4 });
  expect(parseMigrationsView({ page: 'x' })).toEqual({ run: null, page: 1 });
  expect(parseMigrationsView({ page: '0' })).toEqual({ run: null, page: 1 });
});

it('names by locale', () => {
  expect(named({ en: 'A', zh: '甲' }, 'zh')).toBe('甲');
  expect(named({ en: 'A', zh: '甲' }, 'en')).toBe('A');
});
