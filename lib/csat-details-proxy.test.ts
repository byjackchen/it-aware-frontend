import { afterEach, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/dashboard/survey-analytics/servicenow-month-details/route';

vi.mock('next/headers', () => ({ cookies: async () => ({
  get: () => ({ value: 'test-token' }),
  getAll: () => [{ name: 'it_aware_access', value: 'test-token' }],
}) }));

afterEach(() => vi.unstubAllGlobals());

it('forwards the literal ticket ID together with the month, scope, page and score filters', async () => {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ tickets: [] }));
  vi.stubGlobal('fetch', fetchMock);
  const query = new URLSearchParams({ batch_oid: 'batch', month: '2026-07', scope: 'all', page: '2',
    ticket_id: "INC_%'&", rated_only: 'true' });
  query.append('ratings', '4');
  query.append('ratings', '5');
  const response = await GET(new Request(`http://localhost/api/dashboard/survey-analytics/servicenow-month-details?${query}`));
  expect(response.status).toBe(200);
  const upstream = fetchMock.mock.calls[0][0] as URL;
  expect([...upstream.searchParams.entries()]).toEqual(expect.arrayContaining([...query.entries()]));
});
