import { afterEach, expect, it, vi } from 'vitest';
import { getTaskAccess } from '@/lib/api/tasks';
import { ApiError } from '@/lib/api/errors';

vi.mock('next/headers', () => ({ cookies: async () => ({
  getAll: () => [{ name: 'it_aware_access', value: 'test-token' }, { name: 'other', value: 'x' }],
}) }));

afterEach(() => vi.unstubAllGlobals());

it('reads who has what tasks from the backend, with the session cookie', async () => {
  const access = { groupings: [], tasks: [], groups: [], accounts: [] };
  const fetchMock = vi.fn().mockResolvedValue(Response.json(access));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getTaskAccess()).toEqual(access);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toMatch(/\/tasks\/access$/);
  expect(init.headers.Cookie).toBe('it_aware_access=test-token');
});

it('passes every failure on, a 404 like any other: the task routes are always there', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: 'Permission denied' }, { status: 403 })));
  await expect(getTaskAccess()).rejects.toEqual(new ApiError('Permission denied', 403));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: 'Not Found' }, { status: 404 })));
  await expect(getTaskAccess()).rejects.toEqual(new ApiError('Not Found', 404));
});

// --- Tasks 3: the home page, pins, recents and the admin-set profile ---------------

import {
  getAccountProfile,
  getTaskHome,
  getTasksMine,
  pinTask,
  putAccountProfile,
  recordOpened,
  unpinTask,
} from '@/lib/api/tasks';

const home = { start: null, admin_set: [], pinned: [], recent: [], other: [] };
const profile = {
  account_oid: 'abc', start_task: null, home_tasks: ['persona-dashboard'], updated_at: null, updated_by: null,
};
const notFound = () => vi.fn().mockResolvedValue(Response.json({ detail: 'Not Found' }, { status: 404 }));

it("reads the person's home, and fails when the backend does", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(home));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getTaskHome()).toEqual(home);
  expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/tasks\/home$/);

  vi.stubGlobal('fetch', notFound());
  await expect(getTaskHome()).rejects.toEqual(new ApiError('Not Found', 404));
});

it("reads the person's tasks, and fails when the backend does", async () => {
  const mine = { tasks: [] };
  const fetchMock = vi.fn().mockResolvedValue(Response.json(mine));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getTasksMine()).toEqual(mine);
  expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/tasks\/mine$/);

  vi.stubGlobal('fetch', notFound());
  await expect(getTasksMine()).rejects.toEqual(new ApiError('Not Found', 404));
});

it('pins and unpins a task by its code', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  await pinTask('it-incidents');
  await unpinTask('it-incidents');
  expect(fetchMock.mock.calls.map(([url, init]) => [String(url).replace(/^.*\/tasks/, '/tasks'), init.method])).toEqual([
    ['/tasks/pins/it-incidents', 'PUT'],
    ['/tasks/pins/it-incidents', 'DELETE'],
  ]);
});

it('tells the backend which task was opened', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  await recordOpened('it-tickets', 'vip');
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toMatch(/\/tasks\/recent$/);
  expect([init.method, init.body]).toEqual(['POST', '{"task":"it-tickets","view":"vip"}']);
});

it("reads and sets a user's profile", async () => {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json(profile));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getAccountProfile('abc')).toEqual(profile);
  const update = { start_task: null, home_tasks: ['persona-dashboard'] };
  expect(await putAccountProfile('abc', update)).toEqual(profile);
  const [url, init] = fetchMock.mock.calls[1];
  expect(String(url)).toMatch(/\/auth\/config\/accounts\/abc\/profile$/);
  expect([init.method, JSON.parse(init.body)]).toEqual(['PUT', update]);

  // No profile: the backend's profile switch is off, or the account is gone.
  vi.stubGlobal('fetch', notFound());
  expect(await getAccountProfile('abc')).toBeNull();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: 'Permission denied' }, { status: 403 })));
  await expect(getAccountProfile('abc')).rejects.toEqual(new ApiError('Permission denied', 403));
});

// --- The key metrics on the home's task cards ----------------------------------------

import { getTaskMetrics } from '@/lib/api/tasks';
import { GET as metricsRoute } from '@/app/api/tasks/metrics/route';

const metrics = {
  metrics: [{
    task: 'it-tickets', code: 'active', label: { en: 'active', zh: '进行中' }, unit: 'count', value: 128,
    period: { start: '2026-11-12', end: '2026-11-12', kind: 'now' }, previous_value: 122, computed_at: '2026-11-12T08:00:00Z',
  }],
};

it("reads the metrics of the person's tasks, and fails when the backend does", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(metrics));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getTaskMetrics()).toEqual(metrics);
  expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/tasks\/metrics$/);

  vi.stubGlobal('fetch', notFound());
  await expect(getTaskMetrics()).rejects.toEqual(new ApiError('Not Found', 404));
});

it("the home's metrics route passes the backend's metrics on", async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(metrics)));
  const answer = await metricsRoute();
  expect(answer.status).toBe(200);
  expect(answer.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await answer.json()).toEqual(metrics);
});

it("the home's metrics route answers 401, unlogged, when the sign-in has ended", async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: 'Not authenticated' }, { status: 401 })));
  const answer = await metricsRoute();
  expect(answer.status).toBe(401);
  expect(answer.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await answer.json()).toEqual({ metrics: [] });
  expect(logged).not.toHaveBeenCalled();
  logged.mockRestore();
});

it("the home's metrics route answers no metrics when the backend fails, so the cards stay plain", async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: 'boom' }, { status: 500 })));
  expect(await (await metricsRoute()).json()).toEqual({ metrics: [] });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
  const failed = await metricsRoute();
  expect(failed.status).toBe(200);
  expect(failed.headers.get('Cache-Control')).toBe('private, no-store');
  expect(await failed.json()).toEqual({ metrics: [] });
  expect(logged).toHaveBeenCalledTimes(2);
  logged.mockRestore();
});
