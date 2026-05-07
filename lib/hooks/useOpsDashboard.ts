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

/** Default hard cap on pages when `fetchAll: true` — 20 pages * 1000 rows = 20k. */
const FETCH_ALL_PAGE_CAP = 20;

const cache = new Map<string, CacheEntry<unknown>>();
const promiseCache = new Map<string, Promise<unknown>>();

/**
 * Loop through skip/limit pages until the server returns a short page
 * (end of set) OR we hit {@link FETCH_ALL_PAGE_CAP}. Returns one combined
 * ListResponse covering every page fetched. When the cap is hit, the
 * returned response carries `partial: true` so the page can surface a
 * "still loading, retry" banner.
 *
 * Why not just ask the server for everything at once? The backend caps
 * list endpoints at 1000 rows per request. For the ops dashboard, a
 * 1000-row silent cutoff is the bug we're paging around here.
 */
async function fetchAllPages<
    TParams extends { skip?: number; limit?: number },
    TRow,
>(
    fetcher: (params: TParams) => Promise<ListResponse<TRow>>,
    baseParams: TParams,
    maxPages = FETCH_ALL_PAGE_CAP,
): Promise<ListResponse<TRow>> {
    const pageSize = baseParams.limit ?? 1000;
    const allItems: TRow[] = [];
    let skip = 0;
    let lastTotal: number | null = null;
    let pagesFetched = 0;
    let hitCap = false;

    while (true) {
        const page = await fetcher({ ...baseParams, skip, limit: pageSize });
        lastTotal = page.total ?? lastTotal;

        // Backend already flagged partial (e.g. 5s statement timeout) —
        // return what we have so far plus the page's items, preserving
        // the partial flag so the UI can surface it.
        if (page.partial) {
            return {
                items: [...allItems, ...page.items],
                total: page.total ?? null,
                skip: 0,
                limit: allItems.length + page.items.length,
                partial: true,
            };
        }

        allItems.push(...page.items);
        pagesFetched += 1;
        if (page.items.length < pageSize) break;
        skip += pageSize;
        if (pagesFetched >= maxPages) {
            hitCap = true;
            break;
        }
    }

    return {
        items: allItems,
        total: lastTotal,
        skip: 0,
        limit: allItems.length,
        ...(hitCap ? { partial: true } : {}),
    };
}

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

function useListResource<TParams extends { skip?: number; limit?: number }, TRow>(
    fetcher: (params: TParams) => Promise<ListResponse<TRow>>,
    keyPrefix: string,
    params: TParams,
    enabled: boolean,
    fetchAll: boolean,
): UseOpsDashboardResult<TRow> {
    const cacheKey = useMemo(
        () => stableKey(`${keyPrefix}${fetchAll ? ':all' : ''}`, params),
        [keyPrefix, fetchAll, params],
    );

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

            const fetchPromise = (
                fetchAll
                    ? fetchAllPages(fetcher, paramsRef.current)
                    : fetcher(paramsRef.current)
            )
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
        [cacheKey, enabled, fetchAll, fetcher],
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
    options: { enabled?: boolean; fetchAll?: boolean } = {},
): UseOpsDashboardResult<TicketRow> {
    return useListResource<IncidentListParams, TicketRow>(
        fetchIncidents,
        'ops:incidents',
        params,
        options.enabled ?? true,
        options.fetchAll ?? false,
    );
}

export function useRequests(
    params: RequestListParams = {},
    options: { enabled?: boolean; fetchAll?: boolean } = {},
): UseOpsDashboardResult<TicketRow> {
    return useListResource<RequestListParams, TicketRow>(
        fetchRequests,
        'ops:requests',
        params,
        options.enabled ?? true,
        options.fetchAll ?? false,
    );
}

export function useHardwares(
    params: HardwareListParams = {},
    options: { enabled?: boolean; fetchAll?: boolean } = {},
): UseOpsDashboardResult<HardwareRow> {
    return useListResource<HardwareListParams, HardwareRow>(
        fetchHardwares,
        'ops:hardwares',
        params,
        options.enabled ?? true,
        options.fetchAll ?? false,
    );
}

/** Test / dev utility to clear the in-memory cache (not exported to the pages). */
export function _clearOpsDashboardCache(): void {
    cache.clear();
    promiseCache.clear();
}
