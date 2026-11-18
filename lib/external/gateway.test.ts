import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DELETE, GET, POST } from '@/app/api/external/[app]/[...path]/route';
import { EXTERNAL_APPS, externalApp, frameSrc, fromOwnPage, openAddresses, plainPath, renewSignIn, taskState } from '@/lib/external/gateway';
import { getIdentityFromHeaders } from '@/lib/auth/taihu';

/**
 * External tasks (lib/external/gateway.ts), on Ohla Router and then each other app:
 * the page's check before the frame, and the pass-through every framed request
 * takes to the backend's gateway.
 * The gateway's own checks (the task's rule, the token) are the backend's tests.
 */

const session: { value: string | null; mode?: string } = { value: 'test-token' };
const redirected: string[] = [];

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'it_aware_access' && session.value
        ? { value: session.value }
        : name === 'it_aware_auth_mode' && session.mode
          ? { value: session.mode }
          : undefined,
  }),
}));
vi.mock('@/lib/auth/taihu', () => ({ getIdentityFromHeaders: vi.fn() }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    redirected.push(to);
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT' });
  },
}));

beforeEach(() => {
  session.value = 'test-token';
  session.mode = undefined;
  redirected.length = 0;
  vi.mocked(getIdentityFromHeaders).mockReset();
  vi.mocked(getIdentityFromHeaders).mockResolvedValue({ staffId: 1, loginName: 'alice' });
});
afterEach(() => vi.unstubAllGlobals());

const ROUTER = EXTERNAL_APPS['ohla-router'];
const ctx = (...path: string[]) => ({ params: Promise.resolve({ app: 'ohla-router', path }) });
const routerState = () => taskState(ROUTER);

it('frames a page one level below its prefix, which Next.js keeps as written', () => {
  expect(frameSrc(ROUTER)).toBe('/api/external/ohla-router/console');
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

// --- an expired sign-in, renewed as a page load would renew it -------------------

const TAIHU = { 'x-tai-identity': 'jwe-from-the-gateway', timestamp: '1', signature: 's', 'x-rio-seq': '9' };
const issued = () =>
  new Response(null, {
    status: 200,
    headers: [
      ['set-cookie', 'it_aware_access=fresh; Path=/; HttpOnly'],
      ['set-cookie', 'it_aware_refresh=r2; Path=/; HttpOnly'],
    ],
  });

it('renews a sign-in whose cookie expired, and hands the browser the new cookies', async () => {
  session.value = null;
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(issued())
    .mockResolvedValueOnce(Response.json({ signed_in: true }));
  vi.stubGlobal('fetch', fetchMock);
  const response = await GET(new Request('http://localhost/x', { headers: TAIHU }), ctx('admin', 'api', 'session'));
  expect(response.status).toBe(200);
  expect(response.headers.getSetCookie()).toEqual(['it_aware_access=fresh; Path=/; HttpOnly', 'it_aware_refresh=r2; Path=/; HttpOnly']);
  const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
  expect(String(tokenUrl)).toMatch(/\/auth\/session\/token$/);
  expect(String(tokenInit.body)).toBe('grant_type=sso&username=alice&tai_identity=jwe-from-the-gateway');
  expect(getIdentityFromHeaders).toHaveBeenCalledWith(TAIHU);
  expect(fetchMock.mock.calls[1][1].headers.Cookie).toBe('it_aware_access=fresh');
});

it('renews once when the backend no longer takes the cookie, and retries with the new one', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(issued())
    .mockResolvedValueOnce(Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
  const response = await GET(new Request('http://localhost/x', { headers: TAIHU }), ctx('admin', 'api', 'config'));
  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  expect(fetchMock.mock.calls[2][1].headers.Cookie).toBe('it_aware_access=fresh');
  expect(response.headers.getSetCookie()).toHaveLength(2);
});

it('passes a 401 on when the sign-in cannot be renewed, and never renews twice', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
  vi.stubGlobal('fetch', fetchMock);
  // No Taihu identity on the request: nothing to renew from.
  expect((await GET(new Request('http://localhost/x'), ctx('console'))).status).toBe(401);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  // Renewed for a missing cookie, then refused anyway: no second renewal.
  session.value = null;
  fetchMock.mockReset().mockResolvedValueOnce(issued()).mockResolvedValue(new Response(null, { status: 401 }));
  expect((await GET(new Request('http://localhost/x', { headers: TAIHU }), ctx('console'))).status).toBe(401);
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

it.each([
  ['a password sign-in', 'password'],
  ['a person who signed out', 'logged_out'],
])('does not renew %s', async (_, mode) => {
  session.mode = mode;
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  expect(await renewSignIn(new Request('http://localhost/x', { headers: TAIHU }))).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

it('does not renew when the gateway identity, the backend or its answer fails', async () => {
  vi.mocked(getIdentityFromHeaders).mockRejectedValueOnce(new Error('bad signature'));
  vi.stubGlobal('fetch', vi.fn());
  expect(await renewSignIn(new Request('http://localhost/x', { headers: TAIHU }))).toBeNull();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
  expect(await renewSignIn(new Request('http://localhost/x', { headers: TAIHU }))).toBeNull();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 200, headers: [['set-cookie', 'other=1']] })));
  expect(await renewSignIn(new Request('http://localhost/x', { headers: TAIHU }))).toBeNull();
});

// --- the other external tasks -----------------------------------------------------

it.each([
  ['ohla-knowledge', 'Ohla Knowledge', '/api/external/ohla-knowledge/console', /\/external\/ohla-knowledge\/console$/],
  ['ohla-journey', 'Ohla Journey', '/api/external/ohla-journey/console', /\/external\/ohla-journey\/console$/],
  ['ohla-sidebar', 'Ohla Sidebar', '/api/external/ohla-sidebar/admin', /\/external\/ohla-sidebar\/admin$/],
])('%s is framed at its own page, and asked there before the frame', async (code, name, src, asked) => {
  const app = externalApp(code)!;
  expect(app.name).toBe(name);
  expect(frameSrc(app)).toBe(src);
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await taskState(app)).toBe('not_configured');
  expect(String(fetchMock.mock.calls[0][0])).toMatch(asked);
});

it("passes each app's requests to its own gateway, and names it when unreachable", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
  const own = { params: Promise.resolve({ app: 'ohla-knowledge', path: ['v1', 'items'] }) };
  expect((await GET(new Request('http://localhost/x?q=1'), own)).status).toBe(200);
  expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/external\/ohla-knowledge\/v1\/items\?q=1$/);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
  const down = await GET(new Request('http://localhost/x'), { params: Promise.resolve({ app: 'ohla-sidebar', path: ['admin'] }) });
  expect(down.status).toBe(502);
  expect(await down.json()).toEqual({ error: 'Ohla Sidebar is unavailable' });
});

it('knows no other app: an unknown one is 404 before anything is called', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  for (const code of ['ohla-unknown', 'toString', '__proto__']) {
    expect(externalApp(code)).toBeNull();
    const response = await GET(new Request('http://localhost/x'), { params: Promise.resolve({ app: code, path: ['console'] }) });
    expect(response.status).toBe(404);
  }
  expect(fetchMock).not.toHaveBeenCalled();
});

it("gives each app's own address as its origin, and none for an app without a usable one", () => {
  expect(
    openAddresses({
      OHLA_ROUTER_PUBLIC_URL: 'https://ohla-router.example.com/admin?x=1',
      OHLA_KNOWLEDGE_PUBLIC_URL: 'http://knowledge.example.com:8080/',
      OHLA_JOURNEY_PUBLIC_URL: 'javascript:alert(1)',
      OHLA_SIDEBAR_PUBLIC_URL: 'https://',
    }),
  ).toEqual({ 'ohla-router': 'https://ohla-router.example.com', 'ohla-knowledge': 'http://knowledge.example.com:8080' });
  vi.stubEnv('OHLA_SIDEBAR_PUBLIC_URL', 'https://sidebar.example.com');
  expect(openAddresses()).toEqual({ 'ohla-sidebar': 'https://sidebar.example.com' });
  vi.unstubAllEnvs();
  expect(openAddresses()).toEqual({});
});
