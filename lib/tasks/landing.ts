/**
 * Where a person lands when they open IT-Aware (the root address).
 */

import type { TaskHome } from '@/lib/types/tasks';

export const HOME = '/home';
/** Where everyone landed before the home page existed. */
export const LANDING_BEFORE_HOME = '/dashboard/data-overview';

/**
 * The start page an admin set in the person's profile; the home page when none
 * is set. Without a home answer (the backend's tasks switch is off), the
 * landing page of before.
 */
export function landingAddress(home: TaskHome | null): string {
    if (!home) return LANDING_BEFORE_HOME;
    return home.start ?? HOME;
}
