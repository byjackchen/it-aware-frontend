import { beforeEach, expect, it, vi } from 'vitest';

/** Manage Features' Server Actions (app/actions/features.ts; tests live under lib/, vitest.config.mts): each change is sent,
 * the page revalidated when it was recorded, and a failure answered as data. */

const revalidated: string[] = [];
const sent: unknown[][] = [];
let fail = false;

vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidated.push(path) }));
vi.mock('@/lib/logger', () => ({
  logger: { generateRequestId: () => 'r', info: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/api/features', () => {
  const record = (name: string) =>
    async (...args: unknown[]) => {
      sent.push([name, ...args]);
      if (fail) throw new Error('refused');
      return { oid: 'e1' };
    };
  return {
    attempt: async (work: () => Promise<unknown>) => {
      try {
        return { ok: true, data: await work() };
      } catch (error) {
        return { ok: false, failure: { status: 409, code: 'refused', message: (error as Error).message } };
      }
    },
    flipFlag: record('flag'),
  };
});

import { flipFlag } from '@/app/actions/features';

beforeEach(() => {
  revalidated.length = 0;
  sent.length = 0;
  fail = false;
});

it('sends each change and revalidates the features page', async () => {
  expect(await flipFlag('f', 'source', 'csat', 'go', false)).toEqual({ ok: true, data: { oid: 'e1' } });
  await flipFlag('f', 'source', 'csat', 'over', true);
  expect(sent).toEqual([
    ['flag', 'f', 'source', 'csat', 'go', false],
    ['flag', 'f', 'source', 'csat', 'over', true],
  ]);
  expect(revalidated).toEqual(Array(2).fill('/tasks/features/features'));
});

it('answers a refusal as data and revalidates nothing', async () => {
  fail = true;
  const result = await flipFlag('f', 'source', 'csat', 'go', false);
  expect(result).toEqual({ ok: false, failure: { status: 409, code: 'refused', message: 'refused' } });
  expect(revalidated).toEqual([]);
});
