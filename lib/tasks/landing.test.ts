import { expect, it } from 'vitest';
import { landingAddress } from '@/lib/tasks/landing';

const home = { start: null, admin_set: [], pinned: [], recent: [], other: [] };

it('lands on the start page an admin set', () => {
  expect(landingAddress({ ...home, start: '/data/incidents' })).toBe('/data/incidents');
});

it('lands on the home page when no start page is set', () => {
  expect(landingAddress(home)).toBe('/home');
});

it('lands where people landed before, while the tasks switch is off', () => {
  expect(landingAddress(null)).toBe('/dashboard/data-overview');
});
