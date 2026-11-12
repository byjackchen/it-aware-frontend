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
