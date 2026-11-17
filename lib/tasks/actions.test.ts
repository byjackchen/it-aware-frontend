import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { saveGroupHomeTasks, setTaskPinned } from '@/app/actions/tasks';
import * as api from '@/lib/api/tasks';

/**
 * The server actions of the home page and the home tasks per group (app/actions/tasks.ts).
 */

// Each call as made: the path, and its type when one is given ('layout' or 'page').
const revalidated: [string, string?][] = [];
vi.mock('next/cache', () => ({
  revalidatePath: (...args: [string, string?]) => revalidated.push(args),
}));
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
  // The task frame in the layout reads the pins on every page, so a pin
  // revalidates the whole layout from the root, not only the home page.
  expect(revalidated).toEqual([['/', 'layout'], ['/', 'layout']]);
});

it('answers with the error when a pin fails, and redraws nothing', async () => {
  vi.mocked(api.pinTask).mockRejectedValueOnce(new Error('Not a task you have'));
  expect(await setTaskPinned('no.such', true)).toEqual({ error: 'Not a task you have' });
  vi.mocked(api.pinTask).mockRejectedValueOnce('boom');
  expect(await setTaskPinned('no.such', true)).toEqual({ error: 'Failed to change the pin' });
  expect(revalidated).toEqual([]);
});

it("saves a group's home tasks and redraws the group page and the home", async () => {
  expect(await saveGroupHomeTasks('abc', ['persona-dashboard'])).toEqual({ success: true });
  expect(api.putGroupHomeTasks).toHaveBeenCalledWith('abc', ['persona-dashboard']);
  expect(revalidated).toEqual([['/tasks/access/groups/abc'], ['/home']]);

  vi.mocked(api.putGroupHomeTasks).mockRejectedValueOnce(new Error('Unknown task codes'));
  expect(await saveGroupHomeTasks('abc', ['no-such'])).toEqual({ error: 'Unknown task codes' });
});
