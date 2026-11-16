/**
 * The search panel's two sections, from the groups the search answers with:
 * Tasks first, then Objects (the records, one group per kind). The arrow keys
 * walk `flat`, every result in the order the panel shows them.
 */

import type { SearchGroup, SearchResult } from '@/lib/types/search';

export interface SearchSections {
    tasks: SearchResult[];
    /** The record groups, in the order the search answered them. */
    objects: SearchGroup[];
    flat: SearchResult[];
}

export function sections(groups: SearchGroup[]): SearchSections {
    const tasks = groups.filter(group => group.kind === 'task').flatMap(group => group.results);
    const objects = groups.filter(group => group.kind !== 'task' && group.results.length > 0);
    return { tasks, objects, flat: [...tasks, ...objects.flatMap(group => group.results)] };
}

/** The result an arrow key moves to from `active`, among `count` results; it wraps at either end. */
export function step(active: number, count: number, key: 'ArrowDown' | 'ArrowUp'): number {
    if (count === 0) return 0;
    return (active + (key === 'ArrowDown' ? 1 : count - 1)) % count;
}

export interface TextPart {
    text: string;
    hit: boolean;
}

/** `text` cut where it holds the query (any case), so the panel can mark what matched. */
export function marked(text: string, query: string): TextPart[] {
    const wanted = query.trim().toLowerCase();
    const parts: TextPart[] = [];
    let from = 0;
    while (wanted) {
        const at = text.toLowerCase().indexOf(wanted, from);
        if (at < 0) break;
        if (at > from) parts.push({ text: text.slice(from, at), hit: false });
        parts.push({ text: text.slice(at, at + wanted.length), hit: true });
        from = at + wanted.length;
    }
    if (from < text.length) parts.push({ text: text.slice(from), hit: false });
    return parts;
}
