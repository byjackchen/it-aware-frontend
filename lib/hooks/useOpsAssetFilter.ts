'use client';

/**
 * useOpsAssetFilter — shared Support Group / Procured By / Department
 * filter for every asset-oriented Ops Dashboard page (Asset Overview /
 * In-Stock Assets / Pending Assets / Zero Residual).
 *
 * Picking "AMER OIT Support" on Asset Overview carries the selection
 * into In-Stock / Pending / Zero Residual immediately. Mirrors the
 * geo-shared `useOpsGlobalFilter` hook used by the ticket dashboards.
 *
 * Propagation:
 *   - same tab: module-level pub/sub (instant);
 *   - across tabs: browser `storage` event;
 *   - across reloads: localStorage.
 */

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'itaware.opsDashboard.assetFilter.v1';

export interface OpsAssetFilter {
    supportGroups: string[];
    procuredBy: string[];
    departments: string[];
}

function defaultFilter(): OpsAssetFilter {
    return { supportGroups: [], procuredBy: [], departments: [] };
}

function readStored(): OpsAssetFilter {
    if (typeof window === 'undefined') return defaultFilter();
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultFilter();
        const parsed = JSON.parse(raw) as Partial<OpsAssetFilter>;
        return {
            supportGroups: Array.isArray(parsed.supportGroups) ? parsed.supportGroups : [],
            procuredBy: Array.isArray(parsed.procuredBy) ? parsed.procuredBy : [],
            departments: Array.isArray(parsed.departments) ? parsed.departments : [],
        };
    } catch {
        return defaultFilter();
    }
}

type Listener = (f: OpsAssetFilter) => void;
const listeners = new Set<Listener>();
let current: OpsAssetFilter | null = null;

function broadcast(next: OpsAssetFilter) {
    current = next;
    for (const fn of listeners) fn(next);
}

export function useOpsAssetFilter(): {
    filter: OpsAssetFilter;
    setFilter: (next: OpsAssetFilter | ((prev: OpsAssetFilter) => OpsAssetFilter)) => void;
    setSupportGroups: (v: string[]) => void;
    setProcuredBy: (v: string[]) => void;
    setDepartments: (v: string[]) => void;
    reset: () => void;
} {
    const [filter, setFilterState] = useState<OpsAssetFilter>(
        () => current ?? readStored(),
    );

    useEffect(() => {
        if (current === null) current = readStored();
        if (
            current.supportGroups.length !== filter.supportGroups.length ||
            current.procuredBy.length !== filter.procuredBy.length ||
            current.departments.length !== filter.departments.length
        ) {
            setFilterState(current);
        }

        const fn: Listener = (f) => setFilterState(f);
        listeners.add(fn);

        const onStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY || !e.newValue) return;
            try {
                const parsed = JSON.parse(e.newValue) as OpsAssetFilter;
                broadcast({
                    supportGroups: Array.isArray(parsed.supportGroups) ? parsed.supportGroups : [],
                    procuredBy: Array.isArray(parsed.procuredBy) ? parsed.procuredBy : [],
                    departments: Array.isArray(parsed.departments) ? parsed.departments : [],
                });
            } catch {
                // ignore
            }
        };
        window.addEventListener('storage', onStorage);
        return () => {
            listeners.delete(fn);
            window.removeEventListener('storage', onStorage);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setFilter = useCallback(
        (next: OpsAssetFilter | ((prev: OpsAssetFilter) => OpsAssetFilter)) => {
            const resolved =
                typeof next === 'function'
                    ? (next as (p: OpsAssetFilter) => OpsAssetFilter)(current ?? filter)
                    : next;
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
            } catch {
                // ignore quota / privacy-mode failures.
            }
            broadcast(resolved);
        },
        [filter],
    );

    const setSupportGroups = useCallback(
        (v: string[]) => setFilter((f) => ({ ...f, supportGroups: v })),
        [setFilter],
    );
    const setProcuredBy = useCallback(
        (v: string[]) => setFilter((f) => ({ ...f, procuredBy: v })),
        [setFilter],
    );
    const setDepartments = useCallback(
        (v: string[]) => setFilter((f) => ({ ...f, departments: v })),
        [setFilter],
    );
    const reset = useCallback(() => setFilter(defaultFilter()), [setFilter]);

    return { filter, setFilter, setSupportGroups, setProcuredBy, setDepartments, reset };
}
