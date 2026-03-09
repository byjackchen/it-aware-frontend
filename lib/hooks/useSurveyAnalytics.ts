'use client';

import { useCallback, useEffect, useState } from 'react';

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

interface UseSurveyAnalyticsResult<T> {
    data: T | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const CACHE_TTL_MS = 60_000;

const cache = new Map<string, CacheEntry<unknown>>();
const promiseCache = new Map<string, Promise<unknown>>();

function isCacheFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
    if (!entry) return false;
    return Date.now() < entry.expiresAt;
}

async function fetchEndpoint<T>(url: string): Promise<T> {
    const response = await fetch(url, { cache: 'no-store' });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Not authenticated');
        }
        throw new Error(`Failed to fetch (${response.status})`);
    }

    return response.json() as Promise<T>;
}

export function useSurveyAnalytics<T>(url: string | null): UseSurveyAnalyticsResult<T> {
    const [data, setData] = useState<T | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (force = false): Promise<void> => {
        if (!url) {
            setIsLoading(false);
            return;
        }

        const cached = cache.get(url) as CacheEntry<T> | undefined;
        if (!force && isCacheFresh(cached)) {
            setData(cached.data);
            setError(null);
            setIsLoading(false);
            return;
        }

        const existingPromise = !force ? promiseCache.get(url) : undefined;
        if (existingPromise) {
            try {
                const result = await existingPromise as T;
                setData(result);
                setError(null);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to fetch');
            } finally {
                setIsLoading(false);
            }
            return;
        }

        setIsLoading(true);
        setError(null);

        const fetchPromise = fetchEndpoint<T>(url)
            .then((result) => {
                cache.set(url, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
                return result;
            })
            .finally(() => {
                promiseCache.delete(url);
            });

        promiseCache.set(url, fetchPromise);

        try {
            const result = await fetchPromise;
            setData(result);
            setError(null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch');
        } finally {
            setIsLoading(false);
        }
    }, [url]);

    const refresh = useCallback(async () => {
        if (url) cache.delete(url);
        await load(true);
    }, [url, load]);

    useEffect(() => {
        void load(false);
    }, [load]);

    return { data, isLoading, error, refresh };
}
