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

it('answers 502 with no groups when a search fails, so the bar can tell it from no results', async () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  const failed = async () => {
    const answer = await ask('q=gate');
    return [answer.status, await answer.json()];
  };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 403 })));
  expect(await failed()).toEqual([502, { groups: [] }]);

  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ detail: 'Not Found' }, { status: 404 })));
  expect(await failed()).toEqual([502, { groups: [] }]); // no fallback any more

  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
  expect(await failed()).toEqual([502, { groups: [] }]);
  expect(errors).toHaveBeenCalledTimes(3);

  // Nothing found is not a failure.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ query: 'gate', groups: [] })));
  expect(await failed()).toEqual([200, { groups: [] }]);
});
