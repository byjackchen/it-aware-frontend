/**
 * The frontend's copy of the task catalog (contract v3, `contract-v3.json`,
 * frozen 2026-11-12), and the two helpers every task link goes through.
 *
 * The pages live at their task addresses (lane F4 moved them under
 * `/tasks/...`); an old address answers with a redirect from the legacy
 * registry (lib/legacy/). `pageHref` is the identity since the move, kept so
 * every task link still goes through one place.
 */

import contract from './contract-v3.json';
import type { Grouping, TaskNames, TaskRule } from '@/lib/types/tasks';

export interface ContractView {
    slug: string;
    name: TaskNames;
    requires: TaskRule;
    address: string;
    /** The page's address before the move to `/tasks/...` (the legacy registry's source). */
    old_base: string;
    keywords: string[];
}

export interface ContractTask {
    code: string;
    name: TaskNames;
    grouping: string;
    kind: string;
    address: string;
    views: ContractView[];
}

export const GROUPINGS: Grouping[] = contract.groupings;
export const TASKS = contract.tasks as ContractTask[];

/** Whether `path` is `base` or lies under it, on a segment boundary. */
function under(path: string, base: string): boolean {
    return path === base || path.startsWith(`${base}/`);
}

/** Every view with the task it belongs to. */
const VIEWS = TASKS.flatMap(task => task.views.map(view => ({ task, view })));

/** The page's address for a task address: the same, since the pages live at their task addresses. */
export function pageHref(address: string): string {
    return address;
}

export interface PageTask {
    task: ContractTask;
    view: ContractView;
}

/**
 * The task and view of the page at `pathname`, a view's address or under one
 * (a record or sub-page); the longest match wins. Null for a page that is no
 * task's (the home, the root).
 */
export function resolvePage(pathname: string): PageTask | null {
    let best: PageTask | null = null;
    let length = -1;
    for (const { task, view } of VIEWS) {
        if (under(pathname, view.address) && view.address.length > length) {
            best = { task, view };
            length = view.address.length;
        }
    }
    return best;
}

/** A name in the current language. */
export function named(names: TaskNames, locale: string): string {
    return locale.startsWith('zh') ? names.zh : names.en;
}

/** A grouping's name in the current language; the code for an unknown grouping. */
export function groupingName(code: string, locale: string): string {
    const grouping = GROUPINGS.find(candidate => candidate.code === code);
    return grouping ? named(grouping.name, locale) : code;
}

/**
 * Tasks under their grouping, in the catalog's grouping order; a grouping
 * with no task is left out, and an unknown grouping comes last.
 */
export function byGrouping<T extends { grouping: string }>(tasks: T[]): { grouping: string; tasks: T[] }[] {
    const order = (code: string) => {
        const index = GROUPINGS.findIndex(grouping => grouping.code === code);
        return index < 0 ? GROUPINGS.length : index;
    };
    const groups = new Map<string, T[]>();
    for (const task of tasks) {
        groups.set(task.grouping, [...(groups.get(task.grouping) ?? []), task]);
    }
    return [...groups.entries()]
        .sort(([a], [b]) => order(a) - order(b))
        .map(([grouping, held]) => ({ grouping, tasks: held }));
}
