'use client';

/**
 * React hooks for the Ops Dashboard list endpoints.
 *
 * Mirrors the {@link useSurveyAnalytics} ergonomics — 60s in-memory cache
 * keyed by the full URL, in-flight request dedup, and `{ data, loading,
 * error, refetch }` return shape — but generalised over the dashboard
 * fetchers rather than a single hard-coded URL.
 *
 * All three endpoints are always queried with `view=slim`; the per-hook
 * params object gets serialised into the cache key so switching filters
 * correctly busts/reuses the cache.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    fetchHardwares,
    fetchIncidents,
    fetchRequests,
    type HardwareListParams,
    type HardwareRow,
    type IncidentListParams,
    type ListResponse,
    type RequestListParams,
    type TicketRow,
} from '@/lib/api/ops_dashboard';

interface CacheEntry<T> {
    data: ListResponse<T>;
    expiresAt: number;
}

const CACHE_TTL_MS = 60_000;

const cache = new Map<string, CacheEntry<unknown>>();
const promiseCache = new Map<string, Promise<unknown>>();

function isCacheFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
    if (!entry) return false;
    return Date.now() < entry.expiresAt;
}

export interface UseOpsDashboardResult<T> {
    data: ListResponse<T> | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

function stableKey(prefix: string, params: unknown): string {
    // Deterministic stringify — object keys sorted — so { a, b } and
    // { b, a } with the same values hit the same cache entry.
    return `${prefix}:${JSON.stringify(params, Object.keys((params as object) ?? {}).sort())}`;
}

function useListResource<TParams, TRow>(
    fetcher: (params: TParams) => Promise<ListResponse<TRow>>,
    keyPrefix: string,
    params: TParams,
    enabled: boolean,
): UseOpsDashboardResult<TRow> {
    const cacheKey = useMemo(() => stableKey(keyPrefix, params), [keyPrefix, params]);

    const [data, setData] = useState<ListResponse<TRow> | null>(() => {
        const existing = cache.get(cacheKey) as CacheEntry<TRow> | undefined;
        return isCacheFresh(existing) ? existing.data : null;
    });
    const [loading, setLoading] = useState<boolean>(() => {
        if (!enabled) return false;
        const existing = cache.get(cacheKey) as CacheEntry<TRow> | undefined;
        return !isCacheFresh(existing);
    });
    const [error, setError] = useState<string | null>(null);
    const paramsRef = useRef(params);
    paramsRef.current = params;

    const load = useCallback(
        async (force: boolean): Promise<void> => {
            if (!enabled) {
                setLoading(false);
                return;
            }

            const cached = cache.get(cacheKey) as CacheEntry<TRow> | undefined;
            if (!force && isCacheFresh(cached)) {
                setData(cached.data);
                setError(null);
                setLoading(false);
                return;
            }

            const existingPromise = !force
                ? (promiseCache.get(cacheKey) as Promise<ListResponse<TRow>> | undefined)
                : undefined;
            if (existingPromise) {
                try {
                    const result = await existingPromise;
                    setData(result);
                    setError(null);
                } catch (e) {
                    setError(e instanceof Error ? e.message : 'Failed to fetch');
                } finally {
                    setLoading(false);
                }
                return;
            }

            setLoading(true);
            setError(null);

            const fetchPromise = fetcher(paramsRef.current)
                .then((result) => {
                    cache.set(cacheKey, {
                        data: result as unknown as ListResponse<unknown>,
                        expiresAt: Date.now() + CACHE_TTL_MS,
                    });
                    return result;
                })
                .finally(() => {
                    promiseCache.delete(cacheKey);
                });

            promiseCache.set(cacheKey, fetchPromise);

            try {
                const result = await fetchPromise;
                setData(result);
                setError(null);
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to fetch');
            } finally {
                setLoading(false);
            }
        },
        [cacheKey, enabled, fetcher],
    );

    const refetch = useCallback(async () => {
        cache.delete(cacheKey);
        await load(true);
    }, [cacheKey, load]);

    useEffect(() => {
        void load(false);
    }, [load]);

    return { data, loading, error, refetch };
}

export function useIncidents(
    params: IncidentListParams = {},
    options: { enabled?: boolean } = {},
): UseOpsDashboardResult<TicketRow> {
    return useListResource<IncidentListParams, TicketRow>(
        fetchIncidents,
        'ops:incidents',
        params,
        options.enabled ?? true,
    );
}

export function useRequests(
    params: RequestListParams = {},
    options: { enabled?: boolean } = {},
): UseOpsDashboardResult<TicketRow> {
    return useListResource<RequestListParams, TicketRow>(
        fetchRequests,
        'ops:requests',
        params,
        options.enabled ?? true,
    );
}

export function useHardwares(
    params: HardwareListParams = {},
    options: { enabled?: boolean } = {},
): UseOpsDashboardResult<HardwareRow> {
    return useListResource<HardwareListParams, HardwareRow>(
        fetchHardwares,
        'ops:hardwares',
        params,
        options.enabled ?? true,
    );
}

/** Test / dev utility to clear the in-memory cache (not exported to the pages). */
export function _clearOpsDashboardCache(): void {
    cache.clear();
    promiseCache.clear();
}
