import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { saveAccountProfile, setTaskPinned, taskOpened } from '@/app/actions/tasks';
import * as api from '@/lib/api/tasks';

/**
 * The server actions of the home page and the user profile (app/actions/tasks.ts).
 */

const revalidated: string[] = [];
vi.mock('next/cache', () => ({ revalidatePath: (path: string) => revalidated.push(path) })); // pins revalidate the whole layout since the task frame reads them
vi.mock('@/lib/api/tasks');

beforeEach(() => {
  revalidated.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

it('pins and unpins, and redraws the home', async () => {
  expect(await setTaskPinned('it-incidents', true)).toEqual({ success: true });
  expect(api.pinTask).toHaveBeenCalledWith('it-incidents');
  expect(await setTaskPinned('it-incidents', false)).toEqual({ success: true });
  expect(api.unpinTask).toHaveBeenCalledWith('it-incidents');
  expect(revalidated).toEqual(['/', '/']);
});

it('answers with the error when a pin fails, and redraws nothing', async () => {
  vi.mocked(api.pinTask).mockRejectedValueOnce(new Error('Not a task you have'));
  expect(await setTaskPinned('no.such', true)).toEqual({ error: 'Not a task you have' });
  vi.mocked(api.pinTask).mockRejectedValueOnce('boom');
  expect(await setTaskPinned('no.such', true)).toEqual({ error: 'Failed to change the pin' });
  expect(revalidated).toEqual([]);
});

it("notes an opened page's task and never fails on it", async () => {
  await taskOpened('it-incidents');
  expect(api.recordOpened).toHaveBeenCalledWith('it-incidents');
  vi.mocked(api.recordOpened).mockRejectedValueOnce(new Error('Not Found'));
  await expect(taskOpened('it-incidents')).resolves.toBeUndefined();
});

it("saves a user's profile and redraws the account page and the home", async () => {
  const update = { start_task: 'it-incidents', home_tasks: ['persona-dashboard'] };
  expect(await saveAccountProfile('abc', update)).toEqual({ success: true });
  expect(api.putAccountProfile).toHaveBeenCalledWith('abc', update);
  expect(revalidated).toEqual(['/auth/accounts/abc', '/home']);

  vi.mocked(api.putAccountProfile).mockRejectedValueOnce(new Error('Unknown task codes'));
  expect(await saveAccountProfile('abc', update)).toEqual({ error: 'Unknown task codes' });
});
