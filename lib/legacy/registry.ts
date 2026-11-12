/**
 * The legacy registry: every old page address, its new task address, and the
 * old-style menu's links. Generated into registry.json from the contract's
 * `legacy` list (see README.md); this file only reads it.
 */

import data from './registry.json';
import { fillPattern, findEntry, type LegacyEntry, type LegacyRegistry } from './build';

export const REGISTRY = data as LegacyRegistry;

/** Without a trailing slash, except the root. */
function normalize(pathname: string): string {
    return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

/** The registry entry for an old page address, with its placeholder values; null when none. */
export function findLegacy(pathname: string): { entry: LegacyEntry; values: Record<string, string> } | null {
    return findEntry(REGISTRY.entries, normalize(pathname));
}

/** The new address of an old page address, placeholders carried over; null when the registry has none. */
export function newAddress(pathname: string): string | null {
    const hit = findLegacy(pathname);
    return hit ? fillPattern(hit.entry.new, hit.values) : null;
}
