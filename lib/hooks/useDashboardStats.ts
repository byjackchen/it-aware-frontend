'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DashboardStatsResponse } from '@/lib/types/dashboard';

interface DashboardStatsCacheEntry {
    data: DashboardStatsResponse;
    expiresAt: number;
}

interface UseDashboardStatsResult {
    data: DashboardStatsResponse | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

const CACHE_KEY = 'dashboard-object-stats';
const CACHE_TTL_MS = 60_000;

const statsCache = new Map<string, DashboardStatsCacheEntry>();
const promiseCache = new Map<string, Promise<DashboardStatsResponse>>();

function isCacheFresh(entry: DashboardStatsCacheEntry | undefined): entry is DashboardStatsCacheEntry {
    if (!entry) return false;
    return Date.now() < entry.expiresAt;
}

async function fetchDashboardStats(): Promise<DashboardStatsResponse> {
    const response = await fetch('/api/dashboard/object-stats', {
        cache: 'no-store',
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new Error('Not authenticated');
        }
        throw new Error(`Failed to fetch dashboard stats (${response.status})`);
    }

    return response.json() as Promise<DashboardStatsResponse>;
}

export function useDashboardStats(): UseDashboardStatsResult {
    const [data, setData] = useState<DashboardStatsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (force = false): Promise<void> => {
        const cached = statsCache.get(CACHE_KEY);
        if (!force && isCacheFresh(cached)) {
            setData(cached.data);
            setError(null);
            setIsLoading(false);
            return;
        }

        const existingPromise = !force ? promiseCache.get(CACHE_KEY) : undefined;
        if (existingPromise) {
            try {
                const result = await existingPromise;
                setData(result);
                setError(null);
            } catch (e) {
                const message = e instanceof Error ? e.message : 'Failed to fetch dashboard stats';
                setError(message);
            } finally {
                setIsLoading(false);
            }
            return;
        }

        setIsLoading(true);
        setError(null);

        const fetchPromise = fetchDashboardStats()
            .then((result) => {
                statsCache.set(CACHE_KEY, {
                    data: result,
                    expiresAt: Date.now() + CACHE_TTL_MS,
                });
                return result;
            })
            .finally(() => {
                promiseCache.delete(CACHE_KEY);
            });

        promiseCache.set(CACHE_KEY, fetchPromise);

        try {
            const result = await fetchPromise;
            setData(result);
            setError(null);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Failed to fetch dashboard stats';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const refresh = useCallback(async () => {
        statsCache.delete(CACHE_KEY);
        await load(true);
    }, [load]);

    useEffect(() => {
        void load(false);
    }, [load]);

    return {
        data,
        isLoading,
        error,
        refresh,
    };
}
