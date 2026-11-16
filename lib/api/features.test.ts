import { afterEach, expect, it, vi } from 'vitest';
import * as api from '@/lib/api/features';
import { JobsApiError } from '@/lib/api/jobs';

/** The Manage Features client (lib/api/features.ts) against a stubbed backend. */

const redirected: string[] = [];
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => [{ name: 'it_aware_access', value: 'test-token' }, { name: 'other', value: 'x' }],
  }),
}));
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

it('reads with the session cookie and encodes codes and oids', async () => {
  const fetchMock = stub({ ok: 1 });
  await api.listFeatures();
  await api.getFeature('csat-own-path');
  await api.listMigrationRuns(50, 100);
  await api.getMigrationRun('a/b');
  const urls = fetchMock.mock.calls.map(([url]) => String(url).replace(/^.*\/features/, '/features'));
  expect(urls).toEqual([
    '/features',
    '/features/csat-own-path',
    '/features/migrations?limit=50&offset=100',
    '/features/migrations/a%2Fb',
  ]);
  expect(fetchMock.mock.calls[0][1].headers.Cookie).toBe('it_aware_access=test-token');
  expect(fetchMock.mock.calls[0][1].cache).toBe('no-store');
});

it('sends a flip with its body', async () => {
  const fetchMock = stub({ oid: 'e1' });
  await api.flipFlag('f', 'source', 'csat', 'gates passed', false);
  await api.flipFlag('f', 'source', 'csat', 'override', true);
  const calls = fetchMock.mock.calls.map(([url, init]) => [
    String(url).replace(/^.*\/features/, '/features'),
    init.method,
    JSON.parse(init.body),
  ]);
  expect(calls).toEqual([
    ['/features/f/flags/source', 'PUT', { value: 'csat', reason: 'gates passed', override: false }],
    ['/features/f/flags/source', 'PUT', { value: 'csat', reason: 'override', override: true }],
  ]);
});

it('keeps a refusal code, and sends a 401 to the login page', async () => {
  stub({ detail: { code: 'refused', message: 'gates not passed: freeze' } }, 409);
  const failed = await api.attempt(() => api.flipFlag('f', 'source', 'csat', 'go', false));
  expect(failed).toEqual({ ok: false, failure: { status: 409, code: 'refused', message: 'gates not passed: freeze' } });
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response('not json', { status: 500 })));
  await expect(api.listFeatures()).rejects.toBeInstanceOf(JobsApiError);
  stub({}, 401);
  await expect(api.listFeatures()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirected).toContain('/login');
});
