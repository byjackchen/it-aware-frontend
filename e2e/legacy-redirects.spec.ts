import { test, expect, request, type APIRequestContext } from '@playwright/test';

/**
 * The legacy redirects (lib/legacy/), on since the pages moved under
 * /tasks/... (lane F4): an old page address answers 307 to its new address,
 * placeholders and the query string carried over, before any sign-in check.
 * The kept addresses and /api/** are never redirected. Asked without a
 * session and without following redirects, so each answer is the proxy's own.
 */

let api: APIRequestContext;

test.beforeAll(async ({ baseURL }) => {
  api = await request.newContext({ baseURL, maxRedirects: 0, storageState: { cookies: [], origins: [] } });
});

test.afterAll(async () => {
  await api.dispose();
});

/** Where `path` redirects to (path and query), with the status. */
async function redirectOf(path: string): Promise<{ status: number; to: string }> {
  const response = await api.get(path);
  const location = response.headers()['location'] ?? '';
  const target = location ? new URL(location, 'http://localhost') : null;
  return { status: response.status(), to: target ? target.pathname + target.search : '' };
}

test.describe('old page addresses', () => {
  const cases: [string, string, string][] = [
    ['view', '/operation-teams/ops-dashboard/vip-tickets', '/tasks/it-tickets/vip'],
    ['view, query kept', '/data/workers?tab=active&page=2', '/tasks/workers/workers?tab=active&page=2'],
    ['record', '/data/incidents/AbCdEfGhIjKlMnOpQrStUv', '/tasks/it-incidents/AbCdEfGhIjKlMnOpQrStUv'],
    ['record, query kept', '/auth/accounts/AbCdEfGhIjKlMnOpQrStUv?edit=1', '/tasks/access/accounts/AbCdEfGhIjKlMnOpQrStUv?edit=1'],
    ['record sub-page', '/data/locations/new', '/tasks/workers/locations/new'],
    ['area', '/auth', '/tasks/access/permissions'],
    ['area', '/campaign/survey-analytics', '/tasks/it-operations-dashboard/csat'],
    ['special', '/knowledge/faqs', '/tasks/it-knowledge/library'],
    ['special', '/systems/llm_proxy/models', '/home'],
    ['pattern', '/ohla-journey/timeline?from=2026-01-01', '/tasks/ohla-journey-dashboard/timeline?from=2026-01-01'],
  ];
  for (const [kind, from, to] of cases) {
    test(`${kind}: ${from} answers 307 to ${to}`, async () => {
      expect(await redirectOf(from)).toEqual({ status: 307, to });
    });
  }
});

test.describe('addresses that are not redirected', () => {
  test('the kept addresses go on to the sign-in check', async () => {
    for (const kept of ['/', '/home', '/access-denied']) {
      expect(await redirectOf(kept)).toEqual({ status: 307, to: '/login' });
    }
  });

  test('a new task address goes on to the sign-in check', async () => {
    expect(await redirectOf('/tasks/it-incidents')).toEqual({ status: 307, to: '/login' });
  });

  test('an API address is answered by its route', async () => {
    const response = await api.get('/api/version');
    expect(response.status()).toBe(200);
    expect(response.headers()['location']).toBeUndefined();
  });
});
