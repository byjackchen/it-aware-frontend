/**
 * The old-style menu, drawn only from the legacy registry: groupings, their
 * tasks, and each task's views as links. Shown while the task UI is off.
 */

import type { Requires } from './build';
import { REGISTRY } from './registry';
import { LEGACY_REDIRECTS_ENABLED } from './switch';

export interface MenuLink {
    href: string;
    label: string;
}

export interface MenuTask {
    code: string;
    label: string;
    links: MenuLink[];
}

export interface MenuGroup {
    code: string;
    label: string;
    tasks: MenuTask[];
}

export interface PermissionChecks {
    hasAnyPermission: (codes: string[]) => boolean;
    hasAllPermissions: (codes: string[]) => boolean;
}

/** Whether a view's rule is met, through the user context's own (wildcard) checks. */
export function permits(requires: Requires, checks: PermissionChecks): boolean {
    return requires.check === 'all' ? checks.hasAllPermissions(requires.codes) : checks.hasAnyPermission(requires.codes);
}

/**
 * The menu for a person: the views whose rule they meet, by grouping and task,
 * in contract order. Links go to the old address while the pages live there,
 * and to the new address once the redirects are on.
 */
export function legacyMenu(
    locale: string,
    can: (requires: Requires) => boolean,
    redirectsEnabled = LEGACY_REDIRECTS_ENABLED,
): MenuGroup[] {
    const lang = locale === 'zh' ? 'zh' : 'en';
    const items = REGISTRY.entries
        .flatMap(entry => entry.menu)
        .filter(item => can(item.requires))
        .sort((a, b) => a.position - b.position);
    return REGISTRY.groupings
        .map(grouping => ({
            code: grouping.code,
            label: grouping.name[lang],
            tasks: REGISTRY.tasks
                .filter(task => task.grouping === grouping.code)
                .map(task => ({
                    code: task.code,
                    label: task.name[lang],
                    links: items
                        .filter(item => item.task === task.code)
                        .map(item => ({ href: redirectsEnabled ? item.new : item.old, label: item.label[lang] })),
                }))
                .filter(task => task.links.length > 0),
        }))
        .filter(grouping => grouping.tasks.length > 0);
}
