'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type QueryValue = string | number | boolean | null | undefined;
export type InfiniteQueryParams = Record<string, QueryValue>;

interface InfiniteCacheEntry {
    items: unknown[];
    hasMore: boolean;
    total: number | null;
}

interface EnvelopeListResponse<T> {
    items: T[];
    total?: number;
}

const infiniteCache = new Map<string, InfiniteCacheEntry>();

function toSortedQueryString(query?: InfiniteQueryParams): string {
    if (!query) return '';

    const params = new URLSearchParams();
    Object.entries(query)
        .filter(([, value]) => value !== undefined && value !== null && String(value) !== '')
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([key, value]) => {
            params.set(key, String(value));
        });

    return params.toString();
}

function isEnvelopeListResponse<T>(value: unknown): value is EnvelopeListResponse<T> {
    if (!value || typeof value !== 'object') return false;
    return Array.isArray((value as { items?: unknown }).items);
}

interface UseInfiniteResourceOptions<TItem, TResponse = TItem[]> {
    pageSize?: number;
    query?: InfiniteQueryParams;
    auto?: boolean;
    extractItems?: (response: TResponse) => TItem[];
    getItemKey?: (item: TItem) => string | null | undefined;
    extractTotal?: (response: TResponse) => number | undefined;
    inferHasMore?: (
        response: TResponse,
        pageItems: TItem[],
        totalLoaded: number,
        pageSize: number
    ) => boolean;
}

interface UseInfiniteResourceResult<TItem> {
    items: TItem[];
    total: number | null;
    isInitialLoading: boolean;
    isLoadingMore: boolean;
    error: string | null;
    hasMore: boolean;
    hasLoaded: boolean;
    loadMore: () => Promise<void>;
    reload: () => Promise<void>;
}

export function useInfiniteResource<TItem, TResponse = TItem[]>(
    resource: string,
    options: UseInfiniteResourceOptions<TItem, TResponse> = {}
): UseInfiniteResourceResult<TItem> {
    const {
        pageSize = 100,
        query,
        auto = true,
        extractItems,
        getItemKey,
        extractTotal,
        inferHasMore,
    } = options;

    const queryString = useMemo(() => toSortedQueryString(query), [query]);
    const cacheKey = useMemo(
        () => `${resource}?${queryString}|limit=${pageSize}`,
        [resource, queryString, pageSize]
    );

    const cached = useMemo(() => infiniteCache.get(cacheKey), [cacheKey]);

    const [items, setItems] = useState<TItem[]>(
        cached ? (cached.items as TItem[]) : []
    );
    const [hasMore, setHasMore] = useState(cached ? cached.hasMore : true);
    const [total, setTotal] = useState<number | null>(cached ? cached.total : null);
    const [isInitialLoading, setIsInitialLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasLoaded, setHasLoaded] = useState(Boolean(cached));

    const inFlightRef = useRef(false);

    const resolveItemKey = useCallback((item: TItem): string | null => {
        if (getItemKey) {
            const explicit = getItemKey(item);
            return typeof explicit === 'string' && explicit.length > 0 ? explicit : null;
        }

        if (typeof item === 'object' && item !== null && 'oid' in item) {
            const value = (item as { oid?: unknown }).oid;
            if (typeof value === 'string' && value.length > 0) {
                return value;
            }
        }

        return null;
    }, [getItemKey]);

    const dedupeItems = useCallback((source: TItem[]): TItem[] => {
        const seen = new Set<string>();
        const result: TItem[] = [];

        for (const item of source) {
            const key = resolveItemKey(item);
            if (!key) {
                result.push(item);
                continue;
            }
            if (seen.has(key)) continue;
            seen.add(key);
            result.push(item);
        }

        return result;
    }, [resolveItemKey]);

    const getItems = useCallback((response: TResponse): TItem[] => {
        if (extractItems) return extractItems(response);
        if (isEnvelopeListResponse<TItem>(response)) return response.items;
        throw new Error(`Unexpected ${resource} response shape`);
    }, [extractItems, resource]);

    const getHasMore = useCallback((
        response: TResponse,
        pageItems: TItem[],
        totalLoaded: number,
        knownTotal: number | null
    ) => {
        if (inferHasMore) {
            return inferHasMore(response, pageItems, totalLoaded, pageSize);
        }
        if (typeof knownTotal === 'number' && Number.isFinite(knownTotal)) {
            return totalLoaded < knownTotal;
        }
        return pageItems.length >= pageSize;
    }, [inferHasMore, pageSize]);

    const getTotal = useCallback((response: TResponse): number | null => {
        let value: unknown = null;

        if (extractTotal) {
            value = extractTotal(response);
        } else if (isEnvelopeListResponse<TItem>(response)) {
            value = response.total;
        }

        if (typeof value !== 'number' || !Number.isFinite(value)) return null;
        return value;
    }, [extractTotal]);

    const getHeaderTotal = useCallback((response: Response): number | null => {
        const value = response.headers.get('x-total-count');
        if (!value) return null;
        const parsed = Number.parseInt(value, 10);
        if (!Number.isFinite(parsed) || parsed < 0) return null;
        return parsed;
    }, []);

    const fetchPage = useCallback(async (skip: number, replace: boolean) => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;

        if (replace) {
            setIsInitialLoading(true);
        } else {
            setIsLoadingMore(true);
        }
        setError(null);

        try {
            const params = new URLSearchParams(queryString);
            params.set('skip', String(skip));
            params.set('limit', String(pageSize));

            const response = await fetch(`/api/objects/${resource}?${params.toString()}`, {
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch ${resource} (${response.status})`);
            }

            const headerTotal = getHeaderTotal(response);
            const payload = (await response.json()) as TResponse;
            const pageItems = dedupeItems(getItems(payload));
            const pageTotal = getTotal(payload) ?? headerTotal;

            setItems((prev) => {
                const next = dedupeItems(replace ? pageItems : [...prev, ...pageItems]);
                const nextHasMore = getHasMore(payload, pageItems, next.length, pageTotal);

                setHasMore(nextHasMore);
                setTotal(pageTotal);
                setHasLoaded(true);
                infiniteCache.set(cacheKey, {
                    items: next as unknown[],
                    hasMore: nextHasMore,
                    total: pageTotal,
                });

                return next;
            });
        } catch (e) {
            const message = e instanceof Error ? e.message : `Failed to fetch ${resource}`;
            setError(message);
        } finally {
            inFlightRef.current = false;
            setIsInitialLoading(false);
            setIsLoadingMore(false);
        }
    }, [cacheKey, dedupeItems, getHasMore, getHeaderTotal, getItems, getTotal, pageSize, queryString, resource]);

    const loadMore = useCallback(async () => {
        if (!hasMore || inFlightRef.current) return;
        await fetchPage(items.length, false);
    }, [fetchPage, hasMore, items.length]);

    const reload = useCallback(async () => {
        infiniteCache.delete(cacheKey);
        setItems([]);
        setHasMore(true);
        setTotal(null);
        setHasLoaded(false);
        await fetchPage(0, true);
    }, [cacheKey, fetchPage]);

    useEffect(() => {
        const cache = infiniteCache.get(cacheKey);
        if (cache) {
            setItems(cache.items as TItem[]);
            setHasMore(cache.hasMore);
            setTotal(cache.total);
            setHasLoaded(true);
            setError(null);
            return;
        }

        setItems([]);
        setHasMore(true);
        setTotal(null);
        setHasLoaded(false);
        setError(null);
    }, [cacheKey]);

    useEffect(() => {
        if (!auto || hasLoaded || inFlightRef.current) return;
        void fetchPage(0, true);
    }, [auto, fetchPage, hasLoaded]);

    return {
        items,
        total,
        isInitialLoading,
        isLoadingMore,
        error,
        hasMore,
        hasLoaded,
        loadMore,
        reload,
    };
}
