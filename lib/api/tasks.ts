/**
 * Server-side API client for the task catalog.
 */

import { fetchApi } from '@/lib/api/core';
import { ApiError } from '@/lib/api/errors';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type { AccountProfile, ProfileUpdate, TaskAccess, TaskHome, TasksMine } from '@/lib/types/tasks';

const backend = (path: string) => `${RUNTIME_CONFIG.backend.domain}${path}`;

/** The answer, or null when the backend answers 404: the feature's switch is off, or the backend predates it. */
async function unlessOff<T>(path: string): Promise<T | null> {
    try {
        return await fetchApi<T>(backend(path));
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            return null;
        }
        throw error;
    }
}

/** Who has what tasks. Null while the backend's tasks switch (IT_AWARE_TASKS_ENABLED) is off. */
export async function getTaskAccess(): Promise<TaskAccess | null> {
    return unlessOff<TaskAccess>('/tasks/access');
}

/** The signed-in person's home. Null while the backend's tasks switch is off. */
export async function getTaskHome(): Promise<TaskHome | null> {
    return unlessOff<TaskHome>('/tasks/home');
}

/** The signed-in person's tasks, each with only their views. Null while the backend's tasks switch is off. */
export async function getTasksMine(): Promise<TasksMine | null> {
    return unlessOff<TasksMine>('/tasks/mine');
}

export async function pinTask(code: string): Promise<void> {
    await fetchApi(backend(`/tasks/pins/${encodeURIComponent(code)}`), { method: 'PUT' });
}

export async function unpinTask(code: string): Promise<void> {
    await fetchApi(backend(`/tasks/pins/${encodeURIComponent(code)}`), { method: 'DELETE' });
}

/** Tell the backend the person opened a page of the task `code`; it keeps it when the task is theirs. */
export async function recordOpened(code: string): Promise<void> {
    await fetchApi(backend('/tasks/recent'), { method: 'POST', body: JSON.stringify({ task: code }) });
}

/**
 * The profile an admin set for a user account. Null while the backend's
 * profile switch (IT_AWARE_PROFILES_ENABLED) is off, or for an account that
 * is gone.
 */
export async function getAccountProfile(oid: string): Promise<AccountProfile | null> {
    return unlessOff<AccountProfile>(`/auth/config/accounts/${oid}/profile`);
}

export async function putAccountProfile(oid: string, update: ProfileUpdate): Promise<AccountProfile> {
    return fetchApi<AccountProfile>(backend(`/auth/config/accounts/${oid}/profile`), {
        method: 'PUT',
        body: JSON.stringify(update),
    });
}
