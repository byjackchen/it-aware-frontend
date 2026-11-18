/**
 * The task frame's data, read by the (main) layout on every page.
 */

import { unstable_rethrow } from 'next/navigation';
import { getTaskHome, getTasksMine } from '@/lib/api/tasks';
import { openAddresses } from '@/lib/external/gateway';
import type { Task } from '@/lib/types/tasks';

export interface FrameData {
  /** The person's tasks with their views, for the frame's tabs; null when the backend failed. */
  held: Task[] | null;
  /** The codes the person pinned; null when the backend failed. */
  pinned: string[] | null;
  /** Where a person opens each external task's app on their own, by task code; only the apps with one set. */
  addresses: Record<string, string>;
}

/** A failure the frame can do without; Next.js's own signals are thrown on. */
function orNull(error: unknown): null {
  unstable_rethrow(error);
  return null;
}

/**
 * The person's tasks and pins. Either is null when the backend failed to
 * answer: the frame then shows the task without tabs or pin, and the page
 * under it reports its own failure. An ended sign-in (fetchApi's redirect to
 * the login page on a 401) is thrown on, so the layout redirects before its
 * shell is sent, as a plain HTTP redirect. Caught here, it would leave the
 * redirect to the page, inside the streamed response.
 */
export async function loadFrame(): Promise<FrameData> {
  const [mine, home] = await Promise.all([getTasksMine().catch(orNull), getTaskHome().catch(orNull)]);
  return {
    held: mine ? mine.tasks.map(({ task }) => task) : null,
    pinned: home ? home.pinned.map(task => task.code) : null,
    addresses: openAddresses(),
  };
}
