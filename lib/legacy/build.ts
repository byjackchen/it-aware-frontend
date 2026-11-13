/**
 * Builds the legacy registry from the task catalog contract (lib/tasks/contract-v3.json).
 *
 * Self-contained on purpose: lib/legacy/build-registry.mjs imports this file
 * straight from Node (type stripping), so it uses no path alias, no runtime
 * import and only erasable TypeScript.
 */

export interface Name {
    en: string;
    zh: string;
}

export interface Requires {
    check: 'any' | 'all';
    codes: string[];
}

export type EntryType = 'kept' | 'area' | 'view' | 'record' | 'special' | 'pattern';

interface ContractView {
    slug: string;
    name: Name;
    /** The view's address before the move; null for a view added since, which has none. */
    old_base: string | null;
    requires: Requires;
    address: string;
}

interface ContractTask {
    code: string;
    name: Name;
    grouping: string;
    views: ContractView[];
}

export interface Contract {
    version: number;
    groupings: { code: string; name: Name }[];
    tasks: ContractTask[];
    legacy: { old: string; new: string; type: string }[];
}

/** One link of the old-style menu: a contract view, at its old and new address. */
export interface MenuItem {
    old: string;
    new: string;
    label: Name;
    task: string;
    /** The view's place in the contract, which orders the menu. */
    position: number;
    requires: Requires;
}

/** One old page address (a pattern: `[oid]`, `[label]`, `[section]` stand for one segment). */
export interface LegacyEntry {
    old: string;
    new: string;
    type: EntryType;
    /** The contract views this old address shows, for the old-style menu. */
    menu: MenuItem[];
}

export interface LegacyRegistry {
    source: string;
    version: number;
    groupings: { code: string; name: Name }[];
    tasks: { code: string; name: Name; grouping: string }[];
    entries: LegacyEntry[];
}

const PLACEHOLDER = /^\[([a-z]+)\]$/;

/** The placeholder values when `path` fits `pattern` segment by segment; null otherwise. */
export function matchPattern(pattern: string, path: string): Record<string, string> | null {
    const want = pattern.split('/');
    const have = path.split('/');
    if (want.length !== have.length) return null;
    const values: Record<string, string> = {};
    for (let i = 0; i < want.length; i++) {
        const placeholder = PLACEHOLDER.exec(want[i]);
        if (placeholder) {
            if (!have[i]) return null;
            values[placeholder[1]] = have[i];
        } else if (want[i] !== have[i]) {
            return null;
        }
    }
    return values;
}

/** `pattern` with its placeholders replaced by `values`. */
export function fillPattern(pattern: string, values: Record<string, string>): string {
    return pattern
        .split('/')
        .map(segment => {
            const placeholder = PLACEHOLDER.exec(segment);
            return placeholder ? values[placeholder[1]] : segment;
        })
        .join('/');
}

/** The placeholder names of a pattern, in order. */
export function placeholders(pattern: string): string[] {
    return pattern.split('/').flatMap(segment => {
        const placeholder = PLACEHOLDER.exec(segment);
        return placeholder ? [placeholder[1]] : [];
    });
}

/** How many fixed segments a pattern has: a fixed segment wins over a placeholder. */
function fixedSegments(pattern: string): number {
    return pattern.split('/').filter(segment => !PLACEHOLDER.test(segment)).length;
}

/** The entry whose pattern fits `path`, the most fixed one first, with its placeholder values. */
export function findEntry<T extends { old: string }>(
    entries: T[],
    path: string,
): { entry: T; values: Record<string, string> } | null {
    let best: { entry: T; values: Record<string, string> } | null = null;
    for (const entry of entries) {
        const values = matchPattern(entry.old, path);
        if (values && (!best || fixedSegments(entry.old) > fixedSegments(best.entry.old))) {
            best = { entry, values };
        }
    }
    return best;
}

export function buildRegistry(contract: Contract): LegacyRegistry {
    const entries: LegacyEntry[] = contract.legacy.map(e => ({
        old: e.old,
        new: e.new,
        type: e.type as EntryType,
        menu: [],
    }));
    let position = 0;
    for (const task of contract.tasks) {
        for (const view of task.views) {
            // A view added since the move has no old address: no redirect, and no place in the old-style menu.
            if (view.old_base === null) continue;
            const hit = findEntry(entries, view.old_base);
            if (!hit) {
                throw new Error(`no legacy entry for ${task.code}/${view.slug} (${view.old_base})`);
            }
            hit.entry.menu.push({
                old: view.old_base,
                new: view.address,
                label: view.name,
                task: task.code,
                position: position++,
                requires: view.requires,
            });
        }
    }
    return {
        source: 'lib/tasks/contract-v3.json',
        version: contract.version,
        groupings: contract.groupings.map(g => ({ code: g.code, name: g.name })),
        tasks: contract.tasks.map(t => ({ code: t.code, name: t.name, grouping: t.grouping })),
        entries,
    };
}

/** The registry as the committed file holds it. */
export function serializeRegistry(registry: LegacyRegistry): string {
    return `${JSON.stringify(registry, null, 2)}\n`;
}
