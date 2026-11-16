import { expect, it } from 'vitest';
import {
  canFlip,
  featureHref,
  migrationsHref,
  named,
  parseFeaturesView,
  parseMigrationsView,
  phaseState,
  switchGatesOpen,
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

it('places each phase against the current one', () => {
  expect(phaseState('switch', 'add')).toBe('done');
  expect(phaseState('switch', 'switch')).toBe('current');
  expect(phaseState('switch', 'remove')).toBe('ahead');
});

const gate = (code: string, before: 'switch' | 'remove', passed: boolean | null) => ({
  code,
  before,
  passed,
  name: { en: code, zh: code },
  check: 'c',
  days: 1,
  after_switch: false,
  streak: 0,
  last: null,
});

it('lists the switch gates a flip to new would override, until switched', () => {
  const gates = [gate('g1', 'switch', true), gate('g2', 'switch', null), gate('g3', 'remove', null)];
  expect(switchGatesOpen({ phase: 'add', gates })).toEqual(['g2']);
  expect(switchGatesOpen({ phase: 'planned', gates })).toEqual(['g2']);
  expect(switchGatesOpen({ phase: 'switch', gates })).toEqual([]);
});

it('flips until a remove revision ran, and names by locale', () => {
  const revisions = { add: ['1'], switch: [], remove: ['3'] };
  expect(canFlip({ revisions, ran: ['1'] })).toBe(true);
  expect(canFlip({ revisions, ran: ['1', '3'] })).toBe(false);
  expect(named({ en: 'A', zh: '甲' }, 'zh')).toBe('甲');
  expect(named({ en: 'A', zh: '甲' }, 'en')).toBe('A');
});
