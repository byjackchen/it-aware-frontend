import { afterEach, expect, it, vi } from 'vitest';
import { getDataLayers } from '@/lib/api/data-layers';
import { load } from '@/lib/api/usage';

/** The Data Overview layers client (lib/api/data-layers.ts) against a stubbed backend. */

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

it('reads the layers with the session cookie', async () => {
  const answer = { counted_at: '2026-11-12T10:00:00Z', layers: [] };
  const fetchMock = stub(answer);
  expect(await getDataLayers()).toEqual(answer);
  expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/data\/layers$/);
  expect(fetchMock.mock.calls[0][1].headers.Cookie).toBe('it_aware_access=test-token');
});

it('sends a signed-out person to the login page, and one without the permission to the no-access page', async () => {
  stub({ detail: 'Not authenticated' }, 401);
  await expect(load(getDataLayers)).rejects.toThrow('NEXT_REDIRECT');
  stub({ detail: 'Permission denied' }, 403);
  await expect(load(getDataLayers)).rejects.toThrow('NEXT_REDIRECT');
  expect(redirected).toEqual(['/login', '/access-denied']);
});

it('answers the message of any other failure, to show in place of the columns', async () => {
  stub({ detail: 'counting failed' }, 500);
  expect(await load(getDataLayers)).toEqual({ ok: false, message: 'counting failed' });
});
