'use client';

/**
 * useOpsGlobalFilter — shared global filter for every Ops Dashboard
 * page under MONITORING.
 *
 * The Region/Country/Location slicer + Opened date range used to live
 * in each dashboard's local `useState`, so picking AMER on the Catalog
 * page wouldn't carry over to Incidents — users had to repeat the
 * same selection on every page. This hook lifts the filter out of the
 * page so all consumers stay in lockstep.
 *
 * Propagation:
 *   - within the current tab via a module-level pub/sub (instant);
 *   - across tabs via the browser `storage` event;
 *   - across reloads via localStorage.
 *
 * Defaults: empty geo selection, last 90 days for the date range.
 *
 * Pages that need a different default date window (e.g. OnOffBoarding
 * uses 365 days because the flow is lower-volume) can pass a
 * `dateDefault` override on first read; subsequent reads always honour
 * the persisted value.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Region } from '@/components/ops_dashboard/RegionMap';

const STORAGE_KEY = 'itaware.opsDashboard.globalFilter.v1';

export interface OpsGlobalFilter {
    regions: Region[];
    countries: string[];
    locations: string[];
    /** ISO YYYY-MM-DD, inclusive. `null` = no lower bound. */
    dateFrom: string | null;
    /** ISO YYYY-MM-DD, inclusive. `null` = no upper bound. */
    dateTo: string | null;
}

export interface OpsGlobalFilterOptions {
    /** Lookback window in days when no value is persisted yet. Default 90. */
    defaultLookbackDays?: number;
}

function defaultFromIso(days: number): string {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function defaultFilter(lookback = 90): OpsGlobalFilter {
    return {
        regions: [],
        countries: [],
        locations: [],
        dateFrom: defaultFromIso(lookback),
        dateTo: null,
    };
}

function readStored(lookback: number): OpsGlobalFilter {
    if (typeof window === 'undefined') return defaultFilter(lookback);
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultFilter(lookback);
        const parsed = JSON.parse(raw) as Partial<OpsGlobalFilter>;
        // Defensive coercion — never trust persisted shapes.
        return {
            regions: Array.isArray(parsed.regions) ? (parsed.regions as Region[]) : [],
            countries: Array.isArray(parsed.countries) ? (parsed.countries as string[]) : [],
            locations: Array.isArray(parsed.locations) ? (parsed.locations as string[]) : [],
            dateFrom:
                typeof parsed.dateFrom === 'string' || parsed.dateFrom === null
                    ? parsed.dateFrom
                    : defaultFromIso(lookback),
            dateTo:
                typeof parsed.dateTo === 'string' || parsed.dateTo === null ? parsed.dateTo : null,
        };
    } catch {
        return defaultFilter(lookback);
    }
}

// Module-level subscriber list so multiple consumers in the same tab
// stay in sync without bouncing through the storage event.
type Listener = (f: OpsGlobalFilter) => void;
const listeners = new Set<Listener>();
let current: OpsGlobalFilter | null = null;

function broadcast(next: OpsGlobalFilter) {
    current = next;
    for (const fn of listeners) fn(next);
}

export function useOpsGlobalFilter(options: OpsGlobalFilterOptions = {}): {
    filter: OpsGlobalFilter;
    setFilter: (
        next: OpsGlobalFilter | ((prev: OpsGlobalFilter) => OpsGlobalFilter),
    ) => void;
    setRegions: (v: Region[]) => void;
    setCountries: (v: string[]) => void;
    setLocations: (v: string[]) => void;
    setDateFrom: (v: string | null) => void;
    setDateTo: (v: string | null) => void;
    /** Reset to default empty geo + the supplied lookback date window. */
    reset: () => void;
} {
    const lookback = options.defaultLookbackDays ?? 90;
    const [filter, setFilterState] = useState<OpsGlobalFilter>(
        () => current ?? readStored(lookback),
    );

    useEffect(() => {
        // First mount on the client — replace any SSR default with the
        // hydrated localStorage value if they differ.
        if (current === null) current = readStored(lookback);
        if (
            current.dateFrom !== filter.dateFrom ||
            current.dateTo !== filter.dateTo ||
            current.regions.length !== filter.regions.length ||
            current.countries.length !== filter.countries.length ||
            current.locations.length !== filter.locations.length
        ) {
            setFilterState(current);
        }

        const fn: Listener = (f) => setFilterState(f);
        listeners.add(fn);

        const onStorage = (e: StorageEvent) => {
            if (e.key !== STORAGE_KEY || !e.newValue) return;
            try {
                const parsed = JSON.parse(e.newValue) as OpsGlobalFilter;
                broadcast({
                    regions: Array.isArray(parsed.regions) ? parsed.regions : [],
                    countries: Array.isArray(parsed.countries) ? parsed.countries : [],
                    locations: Array.isArray(parsed.locations) ? parsed.locations : [],
                    dateFrom:
                        typeof parsed.dateFrom === 'string' || parsed.dateFrom === null
                            ? parsed.dateFrom
                            : null,
                    dateTo:
                        typeof parsed.dateTo === 'string' || parsed.dateTo === null
                            ? parsed.dateTo
                            : null,
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
        (next: OpsGlobalFilter | ((prev: OpsGlobalFilter) => OpsGlobalFilter)) => {
            const resolved =
                typeof next === 'function'
                    ? (next as (p: OpsGlobalFilter) => OpsGlobalFilter)(current ?? filter)
                    : next;
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(resolved));
            } catch {
                // ignore quota / privacy mode
            }
            broadcast(resolved);
        },
        [filter],
    );

    const setRegions = useCallback(
        (v: Region[]) => setFilter((f) => ({ ...f, regions: v })),
        [setFilter],
    );
    const setCountries = useCallback(
        (v: string[]) => setFilter((f) => ({ ...f, countries: v })),
        [setFilter],
    );
    const setLocations = useCallback(
        (v: string[]) => setFilter((f) => ({ ...f, locations: v })),
        [setFilter],
    );
    const setDateFrom = useCallback(
        (v: string | null) => setFilter((f) => ({ ...f, dateFrom: v })),
        [setFilter],
    );
    const setDateTo = useCallback(
        (v: string | null) => setFilter((f) => ({ ...f, dateTo: v })),
        [setFilter],
    );
    const reset = useCallback(() => setFilter(defaultFilter(lookback)), [setFilter, lookback]);

    return { filter, setFilter, setRegions, setCountries, setLocations, setDateFrom, setDateTo, reset };
}
