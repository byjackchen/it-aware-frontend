import { afterEach, expect, it, vi } from 'vitest';
import { getTaskAccess } from '@/lib/api/tasks';
import { ApiError } from '@/lib/api/errors';

vi.mock('next/headers', () => ({ cookies: async () => ({
  getAll: () => [{ name: 'it_aware_access', value: 'test-token' }, { name: 'other', value: 'x' }],
}) }));

afterEach(() => vi.unstubAllGlobals());

it('reads who has what tasks from the backend, with the session cookie', async () => {
  const access = { service_lines: [], tasks: [], groups: [], accounts: [] };
  const fetchMock = vi.fn().mockResolvedValue(Response.json(access));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getTaskAccess()).toEqual(access);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toMatch(/\/tasks\/access$/);
  expect(init.headers.Cookie).toBe('it_aware_access=test-token');
});

it('answers null when the backend has the tasks switch off', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: 'Not Found' }, { status: 404 })));
  expect(await getTaskAccess()).toBeNull();
});

it('passes every other failure on', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: 'Permission denied' }, { status: 403 })));
  await expect(getTaskAccess()).rejects.toEqual(new ApiError('Permission denied', 403));
});

// --- Tasks 3: the home page, pins, recents and the admin-set profile ---------------

import {
  getAccountProfile,
  getTaskHome,
  pinTask,
  putAccountProfile,
  recordOpened,
  unpinTask,
} from '@/lib/api/tasks';

const home = { start: null, admin_set: [], pinned: [], recent: [], other: [] };
const profile = {
  account_oid: 'abc', start_task: null, home_tasks: ['persona'], service_line: 'it', updated_at: null, updated_by: null,
};
const off = () => vi.fn().mockResolvedValue(Response.json({ detail: 'Not Found' }, { status: 404 }));

it("reads the person's home, and answers null while the switch is off", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json(home));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getTaskHome()).toEqual(home);
  expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/tasks\/home$/);

  vi.stubGlobal('fetch', off());
  expect(await getTaskHome()).toBeNull();
});

it('pins and unpins a task by its code', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  await pinTask('data.incidents');
  await unpinTask('data.incidents');
  expect(fetchMock.mock.calls.map(([url, init]) => [String(url).replace(/^.*\/tasks/, '/tasks'), init.method])).toEqual([
    ['/tasks/pins/data.incidents', 'PUT'],
    ['/tasks/pins/data.incidents', 'DELETE'],
  ]);
});

it('tells the backend which page was opened', async () => {
  const fetchMock = vi.fn().mockImplementation(async () => new Response(null, { status: 204 }));
  vi.stubGlobal('fetch', fetchMock);
  await recordOpened('/data/incidents/abc');
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toMatch(/\/tasks\/recent$/);
  expect([init.method, init.body]).toEqual(['POST', '{"path":"/data/incidents/abc"}']);
});

it("reads and sets a user's profile", async () => {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json(profile));
  vi.stubGlobal('fetch', fetchMock);
  expect(await getAccountProfile('abc')).toEqual(profile);
  const update = { start_task: null, home_tasks: ['persona'], service_line: 'it' };
  expect(await putAccountProfile('abc', update)).toEqual(profile);
  const [url, init] = fetchMock.mock.calls[1];
  expect(String(url)).toMatch(/\/auth\/config\/accounts\/abc\/profile$/);
  expect([init.method, JSON.parse(init.body)]).toEqual(['PUT', update]);

  vi.stubGlobal('fetch', off());
  expect(await getAccountProfile('abc')).toBeNull();
});
