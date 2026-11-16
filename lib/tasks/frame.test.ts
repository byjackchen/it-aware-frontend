import { afterEach, expect, it, vi } from 'vitest';
import * as api from '@/lib/api/tasks';
import { loadFrame } from '@/lib/tasks/frame';
import type { Task, TaskHome, TasksMine } from '@/lib/types/tasks';

/**
 * The task frame's data (lib/tasks/frame.ts), read by the (main) layout.
 */

vi.mock('@/lib/api/tasks');
afterEach(() => vi.resetAllMocks());

const task = { code: 'it-tickets' } as Task;

it("answers the person's tasks and pins", async () => {
  vi.mocked(api.getTasksMine).mockResolvedValue({ tasks: [{ task }] } as unknown as TasksMine);
  vi.mocked(api.getTaskHome).mockResolvedValue({ pinned: [{ code: 'it-incidents' }] } as unknown as TaskHome);
  expect(await loadFrame()).toEqual({ held: [task], pinned: ['it-incidents'] });
});

it('answers null for what the backend failed to give', async () => {
  vi.mocked(api.getTasksMine).mockRejectedValue(new Error('API Error: 500'));
  vi.mocked(api.getTaskHome).mockRejectedValue(new Error('fetch failed'));
  expect(await loadFrame()).toEqual({ held: null, pinned: null });
});

it('throws on the redirect to the login page, so the layout redirects before its shell', async () => {
  // fetchApi's redirect('/login') on a 401, as next/navigation throws it.
  const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace;/login;307;' });
  vi.mocked(api.getTasksMine).mockRejectedValue(redirect);
  vi.mocked(api.getTaskHome).mockResolvedValue({ pinned: [] } as unknown as TaskHome);
  await expect(loadFrame()).rejects.toBe(redirect);
});
