'use client';

/**
 * Per-view hook for the Ohla Chatbot dashboard.
 *
 * Replaces the legacy `useOhla` hook which paginated /api/objects/interactions
 * (up to 200k rows) and reduced everything in the browser. The new flow:
 *   - One small fetch to /report/ohla-chatbot-<view>
 *   - 120s server-side Redis cache means typical loads are <50ms
 *   - In-memory cache by (view, from, to) so flipping back and forth
 *     between sibling Ohla pages doesn't refetch
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    fetchOhlaChatbotReport,
    type OhlaChatbotReportByView,
    type OhlaChatbotView,
} from '@/lib/api/ohla_chatbot';

interface Options {
    /** YYYY-MM-DD inclusive UTC start day */
    from?: string | null;
    /** YYYY-MM-DD inclusive UTC end day */
    to?: string | null;
    enabled?: boolean;
}

interface State<V extends OhlaChatbotView> {
    data: OhlaChatbotReportByView[V] | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

const reportCache = new Map<string, unknown>();

function cacheKey(view: OhlaChatbotView, from: string | null | undefined, to: string | null | undefined) {
    return `${view}::${from ?? ''}::${to ?? ''}`;
}

export function useOhlaChatbotReport<V extends OhlaChatbotView>(
    view: V,
    { from, to, enabled = true }: Options = {},
): State<V> {
    const [state, setState] = useState<{
        data: OhlaChatbotReportByView[V] | null;
        loading: boolean;
        error: string | null;
    }>({ data: null, loading: enabled, error: null });

    const key = cacheKey(view, from, to);

    const load = useCallback(async () => {
        if (!from || !to) {
            setState({ data: null, loading: false, error: null });
            return;
        }
        setState((s) => ({ ...s, loading: true, error: null }));
        try {
            const cached = reportCache.get(key) as OhlaChatbotReportByView[V] | undefined;
            if (cached) {
                setState({ data: cached, loading: false, error: null });
                return;
            }
            const data = await fetchOhlaChatbotReport(view, { date_from: from, date_to: to });
            reportCache.set(key, data);
            setState({ data, loading: false, error: null });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setState({ data: null, loading: false, error: msg });
        }
    }, [view, key, from, to]);

    useEffect(() => {
        if (!enabled) return;
        void load();
    }, [enabled, load]);

    return useMemo<State<V>>(
        () => ({
            ...state,
            refetch: async () => {
                reportCache.delete(key);
                await load();
            },
        }),
        [state, key, load],
    );
}

/**
 * Manually invalidate every cached Ohla Chatbot report. Call after any
 * action that may change underlying interactions (e.g. backfill / sync).
 */
export function clearOhlaChatbotReportCache(): void {
    reportCache.clear();
}
