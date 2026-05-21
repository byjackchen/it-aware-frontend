'use client';

/**
 * Hook backing the Active Monitoring Hub page.
 *
 * Replaces the legacy 4 ``useIncidents`` / ``useRequests`` fetches (each
 * paginating up to 20×1000 rows) with one small call to
 * ``/api/ops-dashboard/report/hub``. The backend returns precomputed KPIs
 * + chart series + filter options; the page reads them directly without
 * any client-side aggregation.
 *
 * Cache: in-memory by params object so repeatedly toggling the same filter
 * combo doesn't refetch within the cache window. Server-side Redis cache
 * means the first cold fetch is still ~tens of ms.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    fetchOpsHubReport,
    type OpsHubReport,
    type OpsHubReportParams,
} from '@/lib/api/ops_dashboard_report';

interface CacheEntry {
    data: OpsHubReport;
    expiresAt: number;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<OpsHubReport>>();

function stableKey(params: OpsHubReportParams): string {
    // Sort keys + sort array values so {region_in:['EMEA','AMER']} and
    // {region_in:['AMER','EMEA']} hit the same cache slot.
    const sortedKeys = Object.keys(params).sort();
    const parts: string[] = [];
    for (const k of sortedKeys) {
        const v = (params as Record<string, unknown>)[k];
        if (v === undefined || v === null) continue;
        if (Array.isArray(v)) {
            if (v.length === 0) continue;
            const sorted = [...v].sort();
            parts.push(`${k}=${sorted.join(',')}`);
        } else {
            const s = String(v).trim();
            if (!s) continue;
            parts.push(`${k}=${s}`);
        }
    }
    return parts.join('|');
}

export interface UseOpsHubReportResult {
    data: OpsHubReport | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function useOpsHubReport(
    params: OpsHubReportParams,
    options: { enabled?: boolean } = {},
): UseOpsHubReportResult {
    const enabled = options.enabled ?? true;
    const key = useMemo(() => stableKey(params), [params]);
    const paramsRef = useRef(params);
    paramsRef.current = params;

    const [data, setData] = useState<OpsHubReport | null>(() => {
        const e = cache.get(key);
        return e && e.expiresAt > Date.now() ? e.data : null;
    });
    const [loading, setLoading] = useState<boolean>(() => {
        if (!enabled) return false;
        const e = cache.get(key);
        return !(e && e.expiresAt > Date.now());
    });
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(
        async (force: boolean) => {
            if (!enabled) {
                setLoading(false);
                return;
            }
            const cached = cache.get(key);
            if (!force && cached && cached.expiresAt > Date.now()) {
                setData(cached.data);
                setError(null);
                setLoading(false);
                return;
            }

            const pending = !force ? inflight.get(key) : undefined;
            if (pending) {
                try {
                    const result = await pending;
                    setData(result);
                    setError(null);
                } catch (e) {
                    setError(e instanceof Error ? e.message : String(e));
                } finally {
                    setLoading(false);
                }
                return;
            }

            setLoading(true);
            setError(null);
            const promise = fetchOpsHubReport(paramsRef.current)
                .then((result) => {
                    cache.set(key, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
                    return result;
                })
                .finally(() => {
                    inflight.delete(key);
                });
            inflight.set(key, promise);
            try {
                const result = await promise;
                setData(result);
                setError(null);
            } catch (e) {
                setError(e instanceof Error ? e.message : String(e));
            } finally {
                setLoading(false);
            }
        },
        [enabled, key],
    );

    const refetch = useCallback(async () => {
        cache.delete(key);
        await load(true);
    }, [key, load]);

    useEffect(() => {
        void load(false);
    }, [load]);

    return { data, loading, error, refetch };
}

/** Test utility — clears the in-memory cache. Not used in production code. */
export function _clearOpsHubReportCache(): void {
    cache.clear();
    inflight.clear();
}
