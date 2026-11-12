import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { pauseJob, readStepLog, resumeJob, retryFailed, runJob, stopRun } from '@/app/actions/jobs';
import * as api from '@/lib/api/jobs';
import { JOBS_BASE } from '@/lib/jobs/paths';

/** The server actions of Manage Jobs (app/actions/jobs.ts). */

const revalidated: string[] = [];
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidated.push(path) }));
vi.mock('@/lib/api/jobs', async (original) => {
  const real = await original<typeof import('@/lib/api/jobs')>();
  return {
    attempt: real.attempt, JobsApiError: real.JobsApiError,
    pauseJob: vi.fn(), resumeJob: vi.fn(), runJob: vi.fn(), retryFailed: vi.fn(), stopRun: vi.fn(), getStepLog: vi.fn(),
  };
});
vi.mock('next/navigation', () => ({ unstable_rethrow: () => undefined, redirect: () => undefined }));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));

const row = { id: 'r1', outcome: 'succeeded' };

beforeEach(() => {
  revalidated.length = 0;
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

it('controls and recovers, answers the record row, and redraws the page', async () => {
  for (const fn of [api.pauseJob, api.resumeJob, api.runJob, api.retryFailed, api.stopRun]) {
    vi.mocked(fn).mockResolvedValue(row as never);
  }
  expect(await pauseJob('j')).toEqual({ ok: true, data: row });
  expect(await resumeJob('j')).toEqual({ ok: true, data: row });
  expect(await runJob('j', { a: 1 })).toEqual({ ok: true, data: row });
  expect(await retryFailed('j', 'r')).toEqual({ ok: true, data: row });
  expect(await stopRun('j', 'r')).toEqual({ ok: true, data: row });
  expect(api.pauseJob).toHaveBeenCalledWith('j');
  expect(api.resumeJob).toHaveBeenCalledWith('j');
  expect(api.runJob).toHaveBeenCalledWith('j', { a: 1 });
  expect(api.retryFailed).toHaveBeenCalledWith('j', 'r');
  expect(api.stopRun).toHaveBeenCalledWith('j', 'r');
  expect(revalidated).toEqual(Array(5).fill(JOBS_BASE));
});

it('answers the failure, with its code, and redraws nothing', async () => {
  vi.mocked(api.pauseJob).mockRejectedValue(new api.JobsApiError('refused', 503, 'airflow_refused'));
  expect(await pauseJob('gate_locked')).toEqual({
    ok: false, failure: { status: 503, code: 'airflow_refused', message: 'refused' },
  });
  expect(revalidated).toEqual([]);
});

it("reads a step's log on from a token", async () => {
  const log = { content: 'more', truncated: false, next_token: null };
  vi.mocked(api.getStepLog).mockResolvedValue(log as never);
  expect(await readStepLog('j', 'r', 's', 2, -1, 'tok')).toEqual({ ok: true, data: log });
  expect(api.getStepLog).toHaveBeenCalledWith('j', 'r', 's', { tryNumber: 2, mapIndex: -1, token: 'tok' });
});
