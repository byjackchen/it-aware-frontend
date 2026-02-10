'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type QueryValue = string | number | boolean | null | undefined;

type QueryParams = Record<string, QueryValue>;

interface UseLazyResourceListOptions {
    query?: QueryParams;
    auto?: boolean;
}

interface UseLazyResourceListResult<T> {
    items: T[];
    isLoading: boolean;
    error: string | null;
    hasLoaded: boolean;
    load: (force?: boolean) => Promise<T[]>;
    reload: () => Promise<T[]>;
}

const dataCache = new Map<string, unknown[]>();
const promiseCache = new Map<string, Promise<unknown[]>>();

function toQueryString(query?: QueryParams): string {
    if (!query) return '';

    const entries = Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== null && String(value) !== '')
        .sort(([a], [b]) => a.localeCompare(b));

    const params = new URLSearchParams();
    entries.forEach(([key, value]) => {
        params.set(key, String(value));
    });

    return params.toString();
}

async function fetchResourceList<T>(resource: string, queryString: string): Promise<T[]> {
    const url = queryString
        ? `/api/objects/${resource}?${queryString}`
        : `/api/objects/${resource}`;

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to fetch ${resource} (${response.status})`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
        throw new Error(`Unexpected ${resource} response shape`);
    }

    return data as T[];
}

export function useLazyResourceList<T>(
    resource: string,
    options: UseLazyResourceListOptions = {}
): UseLazyResourceListResult<T> {
    const queryString = useMemo(() => toQueryString(options.query), [options.query]);
    const cacheKey = useMemo(
        () => `${resource}${queryString ? `?${queryString}` : ''}`,
        [resource, queryString]
    );

    const cachedItems = useMemo(() => {
        const cached = dataCache.get(cacheKey);
        return cached ? (cached as T[]) : [];
    }, [cacheKey]);

    const [items, setItems] = useState<T[]>(cachedItems);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasLoaded, setHasLoaded] = useState(cachedItems.length > 0);

    const load = useCallback(async (force = false): Promise<T[]> => {
        if (!force) {
            const cached = dataCache.get(cacheKey) as T[] | undefined;
            if (cached) {
                setItems(cached);
                setHasLoaded(true);
                setError(null);
                return cached;
            }
        }

        const existingPromise = !force ? promiseCache.get(cacheKey) : undefined;
        if (existingPromise) {
            const data = (await existingPromise) as T[];
            setItems(data);
            setHasLoaded(true);
            setError(null);
            return data;
        }

        setIsLoading(true);
        setError(null);

        const requestPromise = fetchResourceList<T>(resource, queryString)
            .then((data) => {
                dataCache.set(cacheKey, data as unknown[]);
                return data as unknown[];
            })
            .finally(() => {
                promiseCache.delete(cacheKey);
            });

        promiseCache.set(cacheKey, requestPromise);

        try {
            const data = (await requestPromise) as T[];
            setItems(data);
            setHasLoaded(true);
            return data;
        } catch (e) {
            const message = e instanceof Error ? e.message : `Failed to load ${resource}`;
            setError(message);
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [cacheKey, queryString, resource]);

    const reload = useCallback(async () => {
        dataCache.delete(cacheKey);
        return load(true);
    }, [cacheKey, load]);

    useEffect(() => {
        const cached = dataCache.get(cacheKey) as T[] | undefined;
        if (cached) {
            setItems(cached);
            setHasLoaded(true);
            setError(null);
        } else {
            setItems([]);
            setHasLoaded(false);
            setError(null);
        }
    }, [cacheKey]);

    useEffect(() => {
        if (options.auto && !hasLoaded && !isLoading) {
            void load().catch(() => {
                // Error state is already captured in hook state.
            });
        }
    }, [options.auto, hasLoaded, isLoading, load]);

    return {
        items,
        isLoading,
        error,
        hasLoaded,
        load,
        reload,
    };
}
