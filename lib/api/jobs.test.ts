import { afterEach, expect, it, vi } from 'vitest';
import * as api from '@/lib/api/jobs';
import { JobsApiError, attempt, read, readFailure, toFailure } from '@/lib/api/jobs';

/** The Manage Jobs client (lib/api/jobs.ts) against a stubbed backend. */

const redirected: string[] = [];
vi.mock('next/headers', () => ({ cookies: async () => ({
  getAll: () => [{ name: 'it_aware_access', value: 'test-token' }, { name: 'other', value: 'x' }],
}) }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    redirected.push(to);
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT' });
  },
  unstable_rethrow: (error: unknown) => {
    if ((error as { digest?: string })?.digest === 'NEXT_REDIRECT') throw error;
  },
}));

afterEach(() => vi.unstubAllGlobals());

function stub(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const RUN = 'scheduled__2026-06-01T00:00:00+00:00';
const ENC = 'scheduled__2026-06-01T00%3A00%3A00%2B00%3A00';

it('reads with the session cookie, and encodes every id in the path', async () => {
  const fetchMock = stub({ ok: 1 });
  await api.listJobs();
  await api.getJob('gate_digest');
  await api.listRuns('gate_digest', 25, 50);
  await api.getRun('gate_digest', RUN);
  await api.getStepLog('gate_digest', RUN, 'digest', { tryNumber: 2, mapIndex: -1 });
  await api.getStepLog('gate_digest', RUN, 'digest', { tryNumber: 1, mapIndex: 3, token: 'abc' });
  await api.listActions(null, 50, 0);
  await api.listActions('gate_digest', 50, 100);
  await api.getJobsLoad(30);
  const urls = fetchMock.mock.calls.map(([url]) => String(url).replace(/^.*\/jobs/, '/jobs'));
  expect(urls).toEqual([
    '/jobs',
    '/jobs/gate_digest',
    '/jobs/gate_digest/runs?limit=25&offset=50',
    `/jobs/gate_digest/runs/${ENC}`,
    `/jobs/gate_digest/runs/${ENC}/steps/digest/log?try=2&map_index=-1`,
    `/jobs/gate_digest/runs/${ENC}/steps/digest/log?try=1&map_index=3&token=abc`,
    '/jobs/actions?limit=50&offset=0',
    '/jobs/actions?job_id=gate_digest&limit=50&offset=100',
    '/jobs/load?days=30',
  ]);
  expect(fetchMock.mock.calls[0][1].headers.Cookie).toBe('it_aware_access=test-token');
  expect(fetchMock.mock.calls[0][1].cache).toBe('no-store');
});

it('posts control and recovery calls', async () => {
  const fetchMock = stub({ id: 'row' });
  await api.pauseJob('j');
  await api.resumeJob('j');
  await api.runJob('j', { window_hours: 3 });
  await api.retryFailed('j', RUN);
  await api.stopRun('j', RUN);
  const calls = fetchMock.mock.calls.map(([url, init]) => [
    String(url).replace(/^.*\/jobs/, '/jobs'), init.method, init.body,
  ]);
  expect(calls).toEqual([
    ['/jobs/j/pause', 'POST', undefined],
    ['/jobs/j/resume', 'POST', undefined],
    ['/jobs/j/runs', 'POST', '{"parameters":{"window_hours":3}}'],
    [`/jobs/j/runs/${ENC}/retry-failed`, 'POST', undefined],
    [`/jobs/j/runs/${ENC}/stop`, 'POST', undefined],
  ]);
});

it('keeps the code and message of an Airflow failure', async () => {
  stub({ detail: { code: 'airflow_refused', message: 'Airflow refused it' } }, 503);
  await expect(api.pauseJob('gate_locked')).rejects.toEqual(new JobsApiError('Airflow refused it', 503, 'airflow_refused'));
  stub({ detail: 'Permission denied' }, 403);
  const denied = (await api.listJobs().catch((e: unknown) => e)) as JobsApiError;
  expect([denied.status, denied.code, denied.message]).toEqual([403, null, 'Permission denied']);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 502 })));
  const broken = (await api.listJobs().catch((e: unknown) => e)) as JobsApiError;
  expect([broken.status, broken.code, broken.message]).toEqual([502, null, 'API Error: 502']);
});

it('sends a signed-out person to the login page', async () => {
  stub({ detail: 'Not authenticated' }, 401);
  await expect(api.listJobs()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirected).toEqual(['/login']);
});

it('reads a failure whatever shape its detail has', () => {
  expect(readFailure({ detail: { code: 'x', message: 'y' } }, 409)).toEqual({ code: 'x', message: 'y' });
  expect(readFailure({ detail: { code: 7, message: null } }, 409)).toEqual({ code: null, message: 'API Error: 409' });
  expect(readFailure({ detail: [] }, 422)).toEqual({ code: null, message: 'API Error: 422' });
  expect(readFailure({}, 500)).toEqual({ code: null, message: 'API Error: 500' });
  expect(readFailure(null, 500)).toEqual({ code: null, message: 'API Error: 500' });
});

it('turns a caught error into the failure to show, and throws Next.js signals on', async () => {
  expect(toFailure(new JobsApiError('m', 404, 'not_found'))).toEqual({ status: 404, code: 'not_found', message: 'm' });
  expect(toFailure(new Error('net down'))).toEqual({ status: 0, code: null, message: 'net down' });
  expect(toFailure('boom')).toEqual({ status: 0, code: null, message: 'boom' });
  const signal = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT' });
  expect(() => toFailure(signal)).toThrow(signal);

  expect(await attempt(async () => 1)).toEqual({ ok: true, data: 1 });
  expect(await attempt(async () => { throw new Error('no'); })).toEqual({
    ok: false, failure: { status: 0, code: null, message: 'no' },
  });
});

it('refuses a dot-segment or out-of-set id with the backend\'s 422, and fetches nothing', async () => {
  const fetchMock = stub({});
  for (const call of [
    () => api.getJob('..'),
    () => api.listRuns('.', 25, 0),
    () => api.getRun('j', '..'),
    () => api.getStepLog('j', RUN, '..', { tryNumber: 1, mapIndex: -1 }),
    () => api.pauseJob('a/b'),
    () => api.resumeJob('..'),
    () => api.runJob('..', {}),
    () => api.retryFailed('j', '.'),
    () => api.stopRun('..', RUN),
  ]) {
    await expect(call()).rejects.toEqual(new JobsApiError('Not a job, run or step id.', 422, 'invalid_id'));
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

it("sends a person without the permission to the no-access page from a page's read, and shows any other failure", async () => {
  redirected.length = 0;
  stub({ detail: 'Permission denied' }, 403);
  await expect(read(() => api.getJobsLoad(7))).rejects.toThrow('NEXT_REDIRECT');
  expect(redirected).toEqual(['/access-denied']);
  stub({ detail: { code: 'not_found', message: 'No such job' } }, 404);
  expect(await read(() => api.getJob('nowhere'))).toEqual({
    ok: false,
    failure: { status: 404, code: 'not_found', message: 'No such job' },
  });
  stub({ ok: 1 });
  expect(await read(() => api.listJobs())).toEqual({ ok: true, data: { ok: 1 } });
  expect(redirected).toEqual(['/access-denied']);
});
