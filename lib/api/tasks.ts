/**
 * Server-side API client for the task catalog.
 */

import { fetchApi } from '@/lib/api/core';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type { Group } from '@/lib/types/security';
import type { TaskAccess, TaskHome, TaskMetrics, TasksMine } from '@/lib/types/tasks';

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

/** Set the tasks on the home of every member of a group (an admin's action). */
export async function putGroupHomeTasks(oid: string, homeTasks: string[]): Promise<Group> {
    return fetchApi<Group>(backend(`/auth/config/groups/${encodeURIComponent(oid)}`), {
        method: 'PUT',
        body: JSON.stringify({ home_tasks: homeTasks }),
    });
}
