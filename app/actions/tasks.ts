'use server';

/**
 * Server Actions for the home page and the home tasks an admin sets per group.
 */

import { revalidatePath } from 'next/cache';
import * as api from '@/lib/api/tasks';
import { logger } from '@/lib/logger';

type Outcome = { success: true } | { error: string };

async function attempt(action: string, failed: string, work: () => Promise<unknown>): Promise<Outcome> {
  const requestId = logger.generateRequestId();
  try {
    await work();
    return { success: true };
  } catch (error) {
    logger.error('Failed', error, { requestId, action });
    return { error: error instanceof Error ? error.message : failed };
  }
}

/** Pin or unpin one of the signed-in person's tasks. */
export async function setTaskPinned(code: string, pinned: boolean): Promise<Outcome> {
  return attempt('Tasks:setTaskPinned', 'Failed to change the pin', async () => {
    await (pinned ? api.pinTask(code) : api.unpinTask(code));
    // The layout reads the pins for the task frame on every page, so refresh
    // it, not only the home: a pin from search or the home shows in the frame.
    revalidatePath('/', 'layout');
  });
}

/** Save the tasks on the home of a group's members (an admin's action). */
export async function saveGroupHomeTasks(oid: string, homeTasks: string[]): Promise<Outcome> {
  return attempt('Tasks:saveGroupHomeTasks', 'Failed to save the home tasks', async () => {
    await api.putGroupHomeTasks(oid, homeTasks);
    revalidatePath(`/tasks/access/groups/${oid}`);
    revalidatePath('/home');
  });
}
