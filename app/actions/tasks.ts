'use server';

/**
 * Server Actions for the home page and the admin-set user profile.
 */

import { revalidatePath } from 'next/cache';
import * as api from '@/lib/api/tasks';
import { logger } from '@/lib/logger';
import type { ProfileUpdate } from '@/lib/types/tasks';

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

/**
 * Note the task whose page the person opened, and the view it was opened at,
 * for "recent" on their home and for View Usages. It never fails the page:
 * on any error, nothing is kept.
 */
export async function taskOpened(code: string, view: string): Promise<void> {
  try {
    await api.recordOpened(code, view);
  } catch {
    // Recents are a convenience; a page view must not break on them.
  }
}

/** Save the customization part of a user's profile (an admin's action). */
export async function saveAccountProfile(oid: string, update: ProfileUpdate): Promise<Outcome> {
  return attempt('Tasks:saveAccountProfile', 'Failed to save the profile', async () => {
    await api.putAccountProfile(oid, update);
    revalidatePath(`/tasks/access/accounts/${oid}`);
    revalidatePath('/home');
  });
}
