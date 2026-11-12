/**
 * Today's record search (backend GET /objects/registry/search) in the shape of
 * the search bar's groups: the fallback while the backend's search switch
 * (IT_AWARE_SEARCH_ENABLED) is off. It shows what the bar showed before Tasks 2:
 * the kinds it has a page for, in the order they come.
 */

import { SEARCH_CONFIG, getObjectDetailUrl } from '@/lib/config/search';
import type { RegistryEntry } from '@/lib/types/objects';
import type { SearchGroup } from '@/lib/types/search';

export function registryGroups(entries: RegistryEntry[]): SearchGroup[] {
    const groups = new Map<string, SearchGroup>();
    for (const entry of entries) {
        if (!SEARCH_CONFIG[entry.object_type]) continue;
        const group = groups.get(entry.object_type) ?? { kind: entry.object_type, label: null, results: [] };
        group.results.push({
            id: entry.oid,
            title: entry.descriptor,
            subtitle: null,
            opens: getObjectDetailUrl(entry.object_type, entry.oid),
        });
        groups.set(entry.object_type, group);
    }
    return [...groups.values()];
}
