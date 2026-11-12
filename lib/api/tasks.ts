/**
 * Server-side API client for the task catalog.
 */

import { fetchApi } from '@/lib/api/core';
import { ApiError } from '@/lib/api/errors';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import type { TaskAccess } from '@/lib/types/tasks';

/**
 * Who has what tasks. Null when the backend answers 404: its switch
 * (IT_AWARE_TASKS_ENABLED) is off, or it is a backend from before Tasks 1.
 */
export async function getTaskAccess(): Promise<TaskAccess | null> {
    try {
        return await fetchApi<TaskAccess>(`${RUNTIME_CONFIG.backend.domain}/tasks/access`);
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
            return null;
        }
        throw error;
    }
}
