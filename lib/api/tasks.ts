/**
 * Server-side API client for the task catalog.
 */

import { fetchApi } from '@/lib/api/core';
import { ApiError } from '@/lib/api/errors';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type { AccountProfile, ProfileUpdate, TaskAccess, TaskHome, TaskMetrics, TasksMine } from '@/lib/types/tasks';

const backend = (path: string) => `${RUNTIME_CONFIG.backend.domain}${path}`;

/** Who has what tasks. */
export async function getTaskAccess(): Promise<TaskAccess> {
    return fetchApi<TaskAccess>(backend('/tasks/access'));
}

/** The signed-in person's home. */
export async function getTaskHome(): Promise<TaskHome> {
    return fetchApi<TaskHome>(backend('/tasks/home'));
}

/** The signed-in person's tasks, each with only their views. */
export async function getTasksMine(): Promise<TasksMine> {
    return fetchApi<TasksMine>(backend('/tasks/mine'));
}

/** The key metrics of the signed-in person's tasks. */
export async function getTaskMetrics(): Promise<TaskMetrics> {
    return fetchApi<TaskMetrics>(backend('/tasks/metrics'));
}

export async function pinTask(code: string): Promise<void> {
    await fetchApi(backend(`/tasks/pins/${encodeURIComponent(code)}`), { method: 'PUT' });
}

export async function unpinTask(code: string): Promise<void> {
    await fetchApi(backend(`/tasks/pins/${encodeURIComponent(code)}`), { method: 'DELETE' });
}

/**
 * Tell the backend the person opened a page of the task `code`, at the view
 * `view`; it keeps it when the task is theirs, and writes the usage event.
 */
export async function recordOpened(code: string, view: string): Promise<void> {
    await fetchApi(backend('/tasks/recent'), { method: 'POST', body: JSON.stringify({ task: code, view }) });
}

/**
 * The profile an admin set for a user account. Null for an account that is
 * gone (404).
 */
export async function getAccountProfile(oid: string): Promise<AccountProfile | null> {
    try {
        return await fetchApi<AccountProfile>(backend(`/auth/config/accounts/${oid}/profile`));
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            return null;
        }
        throw error;
    }
}

export async function putAccountProfile(oid: string, update: ProfileUpdate): Promise<AccountProfile> {
    return fetchApi<AccountProfile>(backend(`/auth/config/accounts/${oid}/profile`), {
        method: 'PUT',
        body: JSON.stringify(update),
    });
}
