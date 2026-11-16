import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/search/route';

vi.mock('next/headers', () => ({ cookies: async () => ({
  getAll: () => [{ name: 'it_aware_access', value: 'test-token' }, { name: 'other', value: 'x' }],
}) }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const groups = [
  { kind: 'task', label: 'Tasks', results: [{ id: 'it-incidents', title: 'View IT Incidents', subtitle: 'Data', opens: '/tasks/it-incidents', score: 0.9 }] },
];
const entry = (object_type: string, oid: string, descriptor: string) =>
  ({ oid, object_type, descriptor, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' });

const ask = (query: string) => GET(new Request(`http://localhost/api/search?${query}`));

it('answers nothing for an empty query, without asking the backend', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  expect(await (await ask('q=%20%20')).json()).toEqual({ groups: [] });
  expect(await (await ask('')).json()).toEqual({ groups: [] });
  expect(fetchMock).not.toHaveBeenCalled();
});

it("passes the backend's groups through, with the session cookie and the language", async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ query: 'incid', groups }));
  vi.stubGlobal('fetch', fetchMock);
  expect(await (await ask('q=%20incid%20&lang=zh&limit=7')).json()).toEqual({ groups });
  const [url, init] = fetchMock.mock.calls[0];
  expect(new URL(url).pathname).toBe('/search');
  expect(Object.fromEntries(new URL(url).searchParams)).toEqual({ q: 'incid', lang: 'zh', limit: '7' });
  expect(init.headers.Cookie).toBe('it_aware_access=test-token');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("falls back to today's record search when the backend's search is off", async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(Response.json({ detail: 'Not Found' }, { status: 404 }))
    .mockResolvedValueOnce(Response.json([
      entry('worker', 'w1', 'Gate Alice'),
      entry('incident', 'i1', 'INC0001'), // a kind the bar had no page for
      entry('organization', 'o1', 'Gate Org'),
      entry('worker', 'w2', 'Gate Bob'),
    ]));
  vi.stubGlobal('fetch', fetchMock);
  expect(await (await ask('q=gate&lang=fr')).json()).toEqual({ groups: [
    { kind: 'worker', label: null, results: [
      { id: 'w1', title: 'Gate Alice', subtitle: null, opens: '/tasks/workers/workers/w1' },
      { id: 'w2', title: 'Gate Bob', subtitle: null, opens: '/tasks/workers/workers/w2' },
    ] },
    { kind: 'organization', label: null, results: [
      { id: 'o1', title: 'Gate Org', subtitle: null, opens: '/tasks/workers/organizations/o1' },
    ] },
  ] });
  const second = new URL(fetchMock.mock.calls[1][0]);
  expect(second.pathname).toBe('/objects/registry/search');
  expect(Object.fromEntries(second.searchParams)).toEqual({ q: 'gate', limit: '20' });
  expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('lang')).toBe('en');
});

it('answers 502 with no groups when a search fails, so the bar can tell it from no results', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const failed = async () => {
    const answer = await ask('q=gate');
    return [answer.status, await answer.json()];
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 403 })));
  expect(await failed()).toEqual([502, { groups: [] }]);

  vi.stubGlobal('fetch', vi.fn()
    .mockResolvedValueOnce(Response.json({}, { status: 404 }))
    .mockResolvedValueOnce(Response.json({}, { status: 500 })));
  expect(await failed()).toEqual([502, { groups: [] }]);

  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
  expect(await failed()).toEqual([502, { groups: [] }]);
  expect(errors).toHaveBeenCalledTimes(3);

  // Nothing found is not a failure.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ query: 'gate', groups: [] })));
  expect(await failed()).toEqual([200, { groups: [] }]);
});
