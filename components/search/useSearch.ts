'use client';

/**
 * Custom hook for search functionality with debouncing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocale } from 'next-intl';
import type { SearchGroup, SearchResponse } from '@/lib/types/search';

interface UseSearchOptions {
    debounceMs?: number;
    minLength?: number;
    limit?: number;
}

interface UseSearchReturn {
    query: string;
    setQuery: (query: string) => void;
    results: SearchGroup[];
    isLoading: boolean;
    /** The last search request failed: there are no results to show, which is not "nothing found". */
    failed: boolean;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    /** Note a task's pin in the results in hand, so they stay right until the next search. */
    setPinned: (code: string, pinned: boolean) => void;
    clear: () => void;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
    const { debounceMs = 300, minLength = 1, limit = 20 } = options;

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchGroup[]>([]);
    const lang = useLocale().startsWith('zh') ? 'zh' : 'en';
    const [isLoading, setIsLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const clear = useCallback(() => {
        setQuery('');
        setResults([]);
        setFailed(false);
        setIsOpen(false);
    }, []);

    const setPinned = useCallback((code: string, pinned: boolean) => {
        setResults(current => current.map(group => group.kind !== 'task' ? group : {
            ...group,
            results: group.results.map(item => (item.id === code ? { ...item, pinned } : item)),
        }));
    }, []);

    useEffect(() => {
        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Don't search if query too short
        if (query.trim().length < minLength) {
            setResults([]);
            setFailed(false);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setIsOpen(true);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const timeoutId = setTimeout(async () => {
            try {
                const params = new URLSearchParams({
                    q: query.trim(),
                    lang,
                    limit: String(limit),
                });

                const response = await fetch(`/api/search?${params.toString()}`, {
                    signal: abortController.signal,
                });

                if (response.ok) {
                    const data: SearchResponse = await response.json();
                    setResults(data.groups);
                    setFailed(false);
                } else {
                    setResults([]);
                    setFailed(true);
                }
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    console.error('Search error:', error);
                    setResults([]);
                    setFailed(true);
                }
            } finally {
                if (!abortController.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }, debounceMs);

        return () => {
            clearTimeout(timeoutId);
            abortController.abort();
        };
    }, [query, debounceMs, minLength, limit, lang]);

    return {
        query,
        setQuery,
        results,
        isLoading,
        failed,
        isOpen,
        setIsOpen,
        setPinned,
        clear,
    };
}
