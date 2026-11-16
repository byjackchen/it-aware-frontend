import { afterEach, expect, it, vi } from 'vitest';
import { getCsatResponses, getRawRecords } from '@/lib/api/data-tasks';

/** The View IT CSAT and View Raw Records clients (lib/api/data-tasks.ts) against a stubbed backend. */

vi.mock('next/headers', () => ({ cookies: async () => ({
  getAll: () => [{ name: 'it_aware_access', value: 'test-token' }],
}) }));

afterEach(() => {
  vi.unstubAllGlobals();
});

function stub(body: unknown) {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json(body));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function paths(fetchMock: ReturnType<typeof stub>): string[] {
  return fetchMock.mock.calls.map(([url]) => {
    const parsed = new URL(String(url));
    return `${parsed.pathname}${parsed.search}`;
  });
}

it('reads csat.responses a page at a time, with the incident when one is asked for', async () => {
  const fetchMock = stub({ items: [], total: 0 });
  expect(await getCsatResponses(100, 200, null)).toEqual({ items: [], total: 0 });
  await getCsatResponses(100, 0, 'INC0012345');
  expect(paths(fetchMock)).toEqual([
    '/csat/responses?limit=100&skip=200',
    '/csat/responses?limit=100&skip=0&incident_number=INC0012345',
  ]);
});

it('reads one raw source by its cursor and key, and refuses a source no view has', async () => {
  const fetchMock = stub({ source: 'erp_orginfo', fields: [], items: [], total: 0, next_cursor: null });
  await getRawRecords('erp_orginfo', 100, null, null);
  await getRawRecords('servicenow_incident', 50, 'abc', 'INC1');
  expect(paths(fetchMock)).toEqual([
    '/raw/erp_orginfo/records?limit=100',
    '/raw/servicenow_incident/records?limit=50&cursor=abc&key=INC1',
  ]);
  await expect(getRawRecords('oit_chatbot_cycles', 100, null, null)).rejects.toThrow('Not a raw source');
  await expect(getRawRecords('../tasks', 100, null, null)).rejects.toThrow('Not a raw source');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
