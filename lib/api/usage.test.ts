import { afterEach, expect, it, vi } from 'vitest';
import { getPersonUsage, getTaskPeople, getUnusedAccess, getUsageByTask, getUsageOverview, getUsagePeople, load } from '@/lib/api/usage';
import { ApiError } from '@/lib/api/errors';

/** The View Usages client (lib/api/usage.ts) against a stubbed backend. */

const redirected: string[] = [];
vi.mock('next/headers', () => ({ cookies: async () => ({
  getAll: () => [{ name: 'it_aware_access', value: 'test-token' }],
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

afterEach(() => {
  vi.unstubAllGlobals();
  redirected.length = 0;
});

function stub(body: unknown, status = 200) {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json(body, { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

it('reads the views and who used what with the session cookie and the window', async () => {
  const fetchMock = stub({ days: 7 });
  expect(await getUsageOverview(7)).toEqual({ days: 7 });
  await getUsageByTask(90);
  await getUnusedAccess('it-incidents', 30, 50, 100);
  await getTaskPeople('it-incidents', 7, 50, 50);
  await getUsagePeople(90, 50, 0);
  await getPersonUsage('QUFB_QU-B', 30);
  expect(fetchMock.mock.calls.map(([url]) => String(url).replace(/^.*\/usage/, '/usage'))).toEqual([
    '/usage/overview?days=7',
    '/usage/tasks?days=90',
    '/usage/unused-access?task=it-incidents&days=30&limit=50&offset=100',
    '/usage/tasks/it-incidents/people?days=7&limit=50&offset=50',
    '/usage/people?days=90&limit=50&offset=0',
    '/usage/people/QUFB_QU-B?days=30',
  ]);
  expect(fetchMock.mock.calls[0][1].headers.Cookie).toBe('it_aware_access=test-token');
});

it('answers the data of a read that worked', async () => {
  stub({ days: 30 });
  expect(await load(() => getUsageOverview(30))).toEqual({ ok: true, data: { days: 30 } });
});

it('sends a signed-out person to the login page', async () => {
  stub({ detail: 'Not authenticated' }, 401);
  await expect(load(() => getUsageOverview(30))).rejects.toThrow('NEXT_REDIRECT');
  expect(redirected).toEqual(['/login']);
});

it('sends a person without the permission to the no-access page', async () => {
  stub({ detail: 'Permission denied' }, 403);
  await expect(load(() => getUsageByTask(30))).rejects.toThrow('NEXT_REDIRECT');
  expect(redirected).toEqual(['/access-denied']);
});

it('answers the message of any other failure, to show on the page', async () => {
  stub({ detail: 'No such task' }, 404);
  expect(await load(() => getUnusedAccess('nowhere', 30, 50, 0))).toEqual({ ok: false, message: 'No such task' });
  expect(await load(() => Promise.reject(new ApiError('boom', 500)))).toEqual({ ok: false, message: 'boom' });
  expect(await load(() => Promise.reject('offline'))).toEqual({ ok: false, message: 'offline' });
  expect(redirected).toEqual([]);
});

it('never sends a task code or oid that could leave its segment', async () => {
  const fetchMock = stub({ days: 30 });
  for (const value of ['.', '..', '%2E%2E', 'a/b', 'a.b', 'a?b', '']) {
    await expect(getTaskPeople(value, 30, 50, 0)).rejects.toThrow('Not a task code or oid');
    await expect(getPersonUsage(value, 30)).rejects.toThrow('Not a task code or oid');
  }
  expect(fetchMock).not.toHaveBeenCalled();
});
