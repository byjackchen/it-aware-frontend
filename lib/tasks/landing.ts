/**
 * Where a person lands when they open IT-Aware (the root address).
 */

import { pageHref } from '@/lib/tasks/catalog';
import type { TaskHome } from '@/lib/types/tasks';

export const HOME = '/home';
/** Where everyone landed before the home page existed: Data Overview Dashboard. */
export const LANDING_BEFORE_HOME = pageHref('/tasks/data-overview');

/**
 * The page of the start task an admin set in the person's profile, where that
 * task opens for them; the home page when none is set. Without a home answer
 * (the backend's tasks switch is off), the landing page of before.
 */
export function landingAddress(home: TaskHome | null): string {
    if (!home) return LANDING_BEFORE_HOME;
    const start = [...home.admin_set, ...home.pinned, ...home.other].find(task => task.code === home.start);
    return start ? pageHref(start.address) : HOME;
}
