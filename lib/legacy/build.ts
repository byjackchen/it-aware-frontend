/**
 * Builds the legacy registry from the task catalog contract (lib/tasks/contract-v3.json).
 *
 * Self-contained on purpose: lib/legacy/build-registry.mjs imports this file
 * straight from Node (type stripping), so it uses no path alias, no runtime
 * import and only erasable TypeScript.
 */

export type EntryType = 'kept' | 'area' | 'view' | 'record' | 'special' | 'pattern';

export interface Contract {
    version: number;
    legacy: { old: string; new: string; type: string }[];
}

/** One old page address (a pattern: `[oid]`, `[label]`, `[section]` stand for one segment) and where it goes. */
export interface LegacyEntry {
    old: string;
    new: string;
    type: EntryType;
}

export interface LegacyRegistry {
    source: string;
    version: number;
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
    return {
        source: 'lib/tasks/contract-v3.json',
        version: contract.version,
        entries: contract.legacy.map(e => ({ old: e.old, new: e.new, type: e.type as EntryType })),
    };
}

/** The registry as the committed file holds it. */
export function serializeRegistry(registry: LegacyRegistry): string {
    return `${JSON.stringify(registry, null, 2)}\n`;
}
