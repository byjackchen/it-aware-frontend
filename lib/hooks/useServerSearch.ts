'use client';

import { useCallback, useRef, useState } from 'react';

interface UseServerSearchResult<T> {
    searchResults: T[];
    isSearching: boolean;
    searchError: string | null;
    searchByStableId: (stableId: string) => Promise<void>;
    clearSearch: () => void;
}

export function useServerSearch<T>(resource: string): UseServerSearchResult<T> {
    const [searchResults, setSearchResults] = useState<T[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    const searchByStableId = useCallback(async (stableId: string) => {
        if (!stableId.trim()) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setIsSearching(true);
        setSearchError(null);
        setSearchResults([]);

        try {
            const params = new URLSearchParams({ stable_id: stableId.trim(), limit: '10' });
            const response = await fetch(`/api/objects/${resource}?${params.toString()}`, {
                cache: 'no-store',
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`Search failed (${response.status})`);
            }

            const payload = (await response.json()) as { items: T[]; total: number };

            if (controller.signal.aborted) return;

            if (payload.items.length === 0) {
                setSearchError(`No ${resource.slice(0, -1)} found with ID: ${stableId}`);
            } else {
                setSearchResults(payload.items);
            }
        } catch (e) {
            if (e instanceof DOMException && e.name === 'AbortError') return;
            const message = e instanceof Error ? e.message : 'Search failed';
            setSearchError(message);
        } finally {
            if (!controller.signal.aborted) {
                setIsSearching(false);
            }
        }
    }, [resource]);

    const clearSearch = useCallback(() => {
        abortRef.current?.abort();
        setSearchResults([]);
        setSearchError(null);
        setIsSearching(false);
    }, []);

    return { searchResults, isSearching, searchError, searchByStableId, clearSearch };
}
