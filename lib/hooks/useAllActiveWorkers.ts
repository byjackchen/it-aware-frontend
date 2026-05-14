'use client';

/**
 * Page through `/api/objects/workers?is_active=true` until exhausted.
 *
 * Used by ops-dashboard pages that need a `worker.oid → field` lookup
 * (e.g. Onboarding date join). The dataset is ~3k rows in dev so a
 * one-shot fetch sits well within reason; we still guard with
 * MAX_PAGES to avoid runaway loops.
 *
 * Mirrors the existing `components/campaign_notifications/useAllActiveWorkers`
 * helper but lives under `lib/hooks` so non-campaign callers can pull
 * it in without crossing a feature-folder boundary. Add a `enabled`
 * gate so dashboards only fetch on demand (e.g. only when the
 * Onboarding tab is active).
 */

import { useCallback, useEffect, useState } from 'react';
import type { Worker } from '@/lib/types/objects';

interface WorkerListEnvelope {
    items: Worker[];
    total?: number;
    skip?: number;
    limit?: number;
}

interface UseAllActiveWorkersOptions {
    /** When false, skip the fetch entirely (loading=false, workers=[]). */
    enabled?: boolean;
}

interface UseAllActiveWorkersResult {
    workers: Worker[];
    loading: boolean;
    error: string | null;
    reload: () => Promise<void>;
}

const PAGE_SIZE = 1000;
const MAX_PAGES = 10; // 10k workers ceiling — well above the 3k current size.

export function useAllActiveWorkers({
    enabled = true,
}: UseAllActiveWorkersOptions = {}): UseAllActiveWorkersResult {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reload = useCallback(async () => {
        if (!enabled) {
            setWorkers([]);
            setLoading(false);
            setError(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const all: Worker[] = [];
            const seen = new Set<string>();
            let skip = 0;
            for (let page = 0; page < MAX_PAGES; page++) {
                const resp = await fetch(
                    `/api/objects/workers?is_active=true&limit=${PAGE_SIZE}&skip=${skip}`,
                    { cache: 'no-store' },
                );
                if (!resp.ok) {
                    throw new Error(`Workers fetch failed (${resp.status})`);
                }
                const env = (await resp.json()) as WorkerListEnvelope;
                const items = Array.isArray(env.items) ? env.items : [];
                for (const w of items) {
                    if (seen.has(w.oid)) continue;
                    seen.add(w.oid);
                    all.push(w);
                }
                if (items.length < PAGE_SIZE) break;
                skip += PAGE_SIZE;
            }
            setWorkers(all);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
            setWorkers([]);
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        void reload();
    }, [reload]);

    return { workers, loading, error, reload };
}
