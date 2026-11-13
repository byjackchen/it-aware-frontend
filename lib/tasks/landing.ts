/**
 * Where a person lands when they open IT-Aware (the root address).
 */

import { pageHref } from '@/lib/tasks/catalog';
import type { TaskHome } from '@/lib/types/tasks';

export const HOME = '/home';

/**
 * The page of the start task an admin set in the person's profile, where that
 * task opens for them; the home page when none is set.
 */
export function landingAddress(home: TaskHome): string {
    const start = [...home.admin_set, ...home.pinned, ...home.other].find(task => task.code === home.start);
    return start ? pageHref(start.address) : HOME;
}
