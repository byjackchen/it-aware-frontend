import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DELETE, GET, POST } from '@/app/api/external/ohla-router/[...path]/route';
import { FRAME_SRC, fromOwnPage, plainPath, routerState } from '@/lib/external/ohla-router';

/**
 * The Ohla Router task (lib/external/ohla-router.ts): the page's check before the
 * frame, and the pass-through every framed request takes to the backend's gateway.
 * The gateway's own checks (the task's rule, the token) are the backend's tests.
 */

const session: { value: string | null } = { value: 'test-token' };
const redirected: string[] = [];

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name === 'it_aware_access' && session.value ? { value: session.value } : undefined) }),
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    redirected.push(to);
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT' });
  },
}));

beforeEach(() => {
  session.value = 'test-token';
  redirected.length = 0;
});
afterEach(() => vi.unstubAllGlobals());

const ctx = (...path: string[]) => ({ params: Promise.resolve({ path }) });

it('frames a page one level below its prefix, which Next.js keeps as written', () => {
  expect(FRAME_SRC).toBe('/api/external/ohla-router/console');
});

it.each([
  [200, 'ready'],
  [204, 'ready'],
  [503, 'not_configured'],
  [502, 'unavailable'],
  [500, 'unavailable'],
])('a gateway answering %i is %s', async (status, state) => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await routerState()).toBe(state);
  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toMatch(/\/external\/ohla-router\/admin\/api\/session$/);
  expect(init.headers).toEqual({ Cookie: 'it_aware_access=test-token' });
});

it('an unreachable backend is unavailable', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
  expect(await routerState()).toBe('unavailable');
});

it.each([
  [401, '/login'],
  [403, '/access-denied'],
])('a gateway answering %i sends the person to %s', async (status, to) => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
  await expect(routerState()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirected).toEqual([to]);
});

it('no sign-in goes to the login page before any call', async () => {
  session.value = null;
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  await expect(routerState()).rejects.toThrow('NEXT_REDIRECT');
  expect(redirected).toEqual(['/login']);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('passes a framed request on with the sign-in, and the answer back with the page headers only', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response('{"ok":true}', {
      status: 201,
      headers: { 'content-type': 'application/json', 'x-frame-options': 'SAMEORIGIN', 'set-cookie': 'router_admin=x', server: 'router' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  const request = new Request('http://localhost/api/external/ohla-router/admin/api/users?x=1', {
    method: 'POST',
    body: '{"login":"bob"}',
    headers: { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', 'x-other': 'dropped', cookie: 'it_aware_access=test-token; other=1' },
  });
  const response = await POST(request, ctx('admin', 'api', 'users'));
  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({ ok: true });
  expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(response.headers.get('server')).toBeNull();

  const [url, init] = fetchMock.mock.calls[0];
  expect(String(url)).toMatch(/\/external\/ohla-router\/admin\/api\/users\?x=1$/);
  expect(init.method).toBe('POST');
  expect(init.headers).toEqual({ Cookie: 'it_aware_access=test-token', 'content-type': 'application/json' });
  expect(new TextDecoder().decode(init.body)).toBe('{"login":"bob"}');
});

it('a GET carries no body, and a 304 comes back empty', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 304, headers: { etag: '"a"' } }));
  vi.stubGlobal('fetch', fetchMock);
  const response = await GET(new Request('http://localhost/api/external/ohla-router/app.js', { headers: { 'if-none-match': '"a"' } }), ctx('app.js'));
  expect(response.status).toBe(304);
  expect(response.headers.get('etag')).toBe('"a"');
  expect(fetchMock.mock.calls[0][1].body).toBeUndefined();
  expect(fetchMock.mock.calls[0][1].headers['if-none-match']).toBe('"a"');
});

it('refuses a change another site asks for, before calling anything', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  for (const site of ['cross-site', 'same-site', null]) {
    const headers: Record<string, string> = site ? { 'sec-fetch-site': site } : {};
    const response = await DELETE(new Request('http://localhost/api/external/ohla-router/admin/api/users/bob', { method: 'DELETE', headers }), ctx('admin', 'api', 'users', 'bob'));
    expect(response.status).toBe(403);
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

it('refuses a path with an empty, . or .. part, and a request with no sign-in', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  expect((await GET(new Request('http://localhost/x'), ctx('a', '..', 'b'))).status).toBe(400);
  session.value = null;
  expect((await GET(new Request('http://localhost/x'), ctx('console'))).status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled();
});

it('says Ohla Router is unavailable when the backend cannot be reached', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
  const response = await GET(new Request('http://localhost/x'), ctx('console'));
  expect(response.status).toBe(502);
});

it('knows plain paths and own pages', () => {
  expect(plainPath(['admin', 'api', 'config'])).toBe(true);
  expect(plainPath([])).toBe(false);
  expect(plainPath(['a', ''])).toBe(false);
  expect(plainPath(['.'])).toBe(false);
  expect(fromOwnPage(new Request('http://localhost/x', { method: 'HEAD' }))).toBe(true);
  expect(fromOwnPage(new Request('http://localhost/x', { method: 'PUT', headers: { 'sec-fetch-site': 'same-origin' } }))).toBe(true);
});
