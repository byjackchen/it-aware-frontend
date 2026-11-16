import { expect, it } from 'vitest';
import { owningTask, pageAddress, pagesWithoutTask } from '@/lib/tasks/pages';

const tasks = [
  { code: 'data.incidents', opens: '/data/incidents' },
  { code: 'operation_teams.ops_dashboard', opens: '/operation-teams/ops-dashboard' },
  { code: 'operation_teams.ops_dashboard.incidents', opens: '/operation-teams/ops-dashboard/incidents' },
];

it('turns a page file into its address', () => {
  expect(pageAddress('app/(main)/data/incidents/[oid]/page.tsx')).toBe('/data/incidents/[oid]');
  expect(pageAddress('/repo/app/(main)/page.tsx')).toBe('/');
  expect(pageAddress('app\\auth\\login\\page.tsx')).toBe('/auth/login');
});

it('finds the task at the address, or the nearest one above it', () => {
  expect(owningTask('/data/incidents', tasks)?.code).toBe('data.incidents');
  expect(owningTask('/data/incidents/[oid]', tasks)?.code).toBe('data.incidents');
  expect(owningTask('/operation-teams/ops-dashboard/incidents/[oid]', tasks)?.code)
    .toBe('operation_teams.ops_dashboard.incidents');
  expect(owningTask('/data/incidents-archive', tasks)).toBeUndefined();
  expect(owningTask('/data', tasks)).toBeUndefined();
});

it('lets a page with a named segment belong to a task at one of its values', () => {
  const journey = [{ code: 'ohla_journey.headline', opens: '/ohla-journey/headline' }];
  expect(owningTask('/ohla-journey/[section]', journey)?.code).toBe('ohla_journey.headline');
  expect(owningTask('/ohla-journey', journey)).toBeUndefined();
  expect(owningTask('/[area]/headline/[oid]', journey)?.code).toBe('ohla_journey.headline');
});

it('lists the pages no task covers', () => {
  const files = [
    'app/(main)/data/workers/page.tsx',
    'app/(main)/data/incidents/[oid]/page.tsx',
    'app/(main)/data/page.tsx',
  ];
  expect(pagesWithoutTask(files, tasks)).toEqual(['/data', '/data/workers']);
});
