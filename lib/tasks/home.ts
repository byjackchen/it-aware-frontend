/**
 * The home page's own rules: the one Pinned row, and the greeting.
 */

import type { Task, TaskHome } from '@/lib/types/tasks';

export interface PinnedCard {
    task: Task;
    /** The person pinned it themselves (they can unpin it); otherwise an administrator set it for them. */
    own: boolean;
}

/**
 * The home's Pinned row: the person's own pins first, in the order pinned,
 * then the tasks an administrator set for them. A task in both shows once, as
 * the person's own pin; unpinned, it is back at its administrator-set place.
 */
export function pinnedRow(home: Pick<TaskHome, 'pinned' | 'admin_set'>): PinnedCard[] {
    const own = new Set(home.pinned.map(task => task.code));
    return [
        ...home.pinned.map(task => ({ task, own: true })),
        ...home.admin_set.filter(task => !own.has(task.code)).map(task => ({ task, own: false })),
    ];
}

export type Greeting = 'morning' | 'afternoon' | 'evening';

/** The greeting for an hour of the day (0 to 23): the evening lasts until 5 in the morning. */
export function greetingAt(hour: number): Greeting {
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    return 'evening';
}

/** The hour of the day (0 to 23) it is at `when` in `timeZone`. */
export function hourIn(when: Date, timeZone: string): number {
    return Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(when));
}
