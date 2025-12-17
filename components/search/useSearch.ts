'use client';

/**
 * Custom hook for search functionality with debouncing.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RegistryEntry } from '@/lib/types/objects';

interface UseSearchOptions {
    debounceMs?: number;
    minLength?: number;
    limit?: number;
}

interface UseSearchReturn {
    query: string;
    setQuery: (query: string) => void;
    results: RegistryEntry[];
    isLoading: boolean;
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    clear: () => void;
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
    const { debounceMs = 300, minLength = 1, limit = 20 } = options;

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<RegistryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const clear = useCallback(() => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
    }, []);

    useEffect(() => {
        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Don't search if query too short
        if (query.trim().length < minLength) {
            setResults([]);
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
                    limit: String(limit),
                });

                const response = await fetch(`/api/search?${params.toString()}`, {
                    signal: abortController.signal,
                });

                if (response.ok) {
                    const data = await response.json();
                    setResults(data);
                }
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    console.error('Search error:', error);
                    setResults([]);
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
    }, [query, debounceMs, minLength, limit]);

    return {
        query,
        setQuery,
        results,
        isLoading,
        isOpen,
        setIsOpen,
        clear,
    };
}
