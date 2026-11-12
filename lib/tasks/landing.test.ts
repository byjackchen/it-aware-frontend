import { expect, it } from 'vitest';
import { landingAddress } from '@/lib/tasks/landing';
import type { Task } from '@/lib/types/tasks';

const task = (code: string, address: string): Task => ({
  code, address, name: { en: code, zh: code }, grouping: 'data', kind: 'internal', external_app: null, keywords: [], views: [],
});
const home = { start: null, admin_set: [], pinned: [], recent: [], other: [] };

it('lands on the start task an admin set, where it opens for the person', () => {
  const incidents = task('it-incidents', '/tasks/it-incidents');
  expect(landingAddress({ ...home, start: 'it-incidents', other: [incidents] })).toBe('/data/incidents');
  // Its address is the first view the person has, wherever the task is listed.
  const workers = task('workers', '/tasks/workers/locations');
  expect(landingAddress({ ...home, start: 'workers', admin_set: [workers] })).toBe('/data/locations');
  expect(landingAddress({ ...home, start: 'workers', pinned: [workers] })).toBe('/data/locations');
});

it('lands on the home page when no start task is set, or it is not among the tasks', () => {
  expect(landingAddress(home)).toBe('/home');
  expect(landingAddress({ ...home, start: 'it-incidents' })).toBe('/home');
});

it('lands where people landed before, while the tasks switch is off', () => {
  expect(landingAddress(null)).toBe('/dashboard/data-overview');
});
