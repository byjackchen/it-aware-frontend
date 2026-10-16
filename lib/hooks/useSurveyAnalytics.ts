'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

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
    const [result, setResult] = useState<{ url: string; data: T | null; error: string | null } | null>(null);
    const [loadingUrl, setLoadingUrl] = useState<string | null>(null);
    const currentUrl = useRef(url);
    currentUrl.current = url;

    const load = useCallback(async (force = false): Promise<void> => {
        if (!url) {
            setLoadingUrl(null);
            return;
        }

        const isCurrent = () => currentUrl.current === url;

        const cached = cache.get(url) as CacheEntry<T> | undefined;
        if (!force && isCacheFresh(cached)) {
            if (isCurrent()) {
                setResult({ url, data: cached.data, error: null });
                setLoadingUrl(null);
            }
            return;
        }

        const existingPromise = !force ? promiseCache.get(url) : undefined;
        if (existingPromise) {
            try {
                const result = await existingPromise as T;
                if (isCurrent()) setResult({ url, data: result, error: null });
            } catch (e) {
                if (isCurrent()) setResult({ url, data: null, error: e instanceof Error ? e.message : 'Failed to fetch' });
            } finally {
                if (isCurrent()) setLoadingUrl(null);
            }
            return;
        }

        setLoadingUrl(url);

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
            if (isCurrent()) setResult({ url, data: result, error: null });
        } catch (e) {
            if (isCurrent()) setResult({ url, data: null, error: e instanceof Error ? e.message : 'Failed to fetch' });
        } finally {
            if (isCurrent()) setLoadingUrl(null);
        }
    }, [url]);

    const refresh = useCallback(async () => {
        if (url) cache.delete(url);
        await load(true);
    }, [url, load]);

    useEffect(() => {
        void load(false);
    }, [load]);

    const visible = result?.url === url ? result : null;
    return {
        data: visible?.data ?? null,
        isLoading: !!url && (loadingUrl === url || !visible),
        error: visible?.error ?? null,
        refresh,
    };
}
