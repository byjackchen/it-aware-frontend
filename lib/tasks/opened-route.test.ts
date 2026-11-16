import { afterEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/tasks/opened/route';
import * as api from '@/lib/api/tasks';

/**
 * POST /api/tasks/opened (app/api/tasks/opened/route.ts): the task frame's
 * record of an opened page, which never fails the page.
 */

vi.mock('@/lib/api/tasks');
afterEach(() => vi.resetAllMocks());

const post = (body: string) => POST(new Request('http://localhost/api/tasks/opened', { method: 'POST', body }));

it("notes an opened page's task and view", async () => {
  const response = await post(JSON.stringify({ task: 'it-tickets', view: 'vip' }));
  expect(response.status).toBe(204);
  expect(api.recordOpened).toHaveBeenCalledWith('it-tickets', 'vip');
});

it('answers 204 when the backend refuses or fails, or the sign-in has ended', async () => {
  vi.mocked(api.recordOpened).mockRejectedValueOnce(new Error('Not Found'));
  expect((await post(JSON.stringify({ task: 'it-tickets', view: 'vip' }))).status).toBe(204);
  // fetchApi's redirect to the login page on a 401 is a thrown signal too.
  vi.mocked(api.recordOpened).mockRejectedValueOnce(Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login;307;' }));
  expect((await post(JSON.stringify({ task: 'it-tickets', view: 'vip' }))).status).toBe(204);
});

it.each([
  ['no JSON', 'not json'],
  ['null', 'null'],
  ['no view', JSON.stringify({ task: 'it-tickets' })],
  ['a task that is no string', JSON.stringify({ task: 7, view: 'vip' })],
])('ignores a body with %s', async (_, body) => {
  expect((await post(body)).status).toBe(204);
  expect(api.recordOpened).not.toHaveBeenCalled();
});
