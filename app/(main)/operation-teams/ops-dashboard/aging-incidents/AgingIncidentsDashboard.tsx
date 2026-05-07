'use client';

/**
 * Aging Incidents (Page 1.3.6) — ports `temp_ref/.../dashboard/aging-incidents/AgingIncidentsPage.tsx`.
 *
 * Base filter: incidents, active state, and — the bit
 * that can't be expressed server-side in Phase 1 — days-no-update > 2.
 * Pagination is therefore client-side: we aggregate the filtered array,
 * slice it, and hand the slice to the shared AgingTable.
 */

import { useMemo, useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useIncidents } from '@/lib/hooks/useOpsDashboard';
import type { TicketRow } from '@/lib/api/ops_dashboard';
import { ACTIVE_STATES, daysSinceUpdated, isActiveState } from '@/lib/ops_dashboard/aggregate';
import {
    AgingTable,
    type AgingTableRow,
} from '@/components/ops_dashboard/AgingTable';
import {
    TopFilterBar,
    type FilterState,
    type SlicerConfig,
} from '@/components/ops_dashboard/filters/TopFilterBar';
import { RegionCountryFilter } from '@/components/ops_dashboard/filters/RegionCountryFilter';
import type { Region } from '@/components/ops_dashboard/RegionMap';
import { matchesRegionCountry } from '@/lib/ops_dashboard/region';

const PAGE_SIZE = 100;

interface Row extends AgingTableRow {
    object_type: 'incident';
    created_at: string;
    updated_at: string;
}

function locationOf(row: TicketRow): string {
    return row.actor?.location?.descriptor?.trim() || '—';
}

/** RegionCountryFilter wants null on missing locations (vs the table's '—'). */
function locationForFilter(row: TicketRow): string | null {
    return row.actor?.location?.descriptor?.trim() || null;
}

function openedByOf(row: TicketRow): string {
    const name = row.actor?.fullname?.trim();
    if (name) return name;
    return row.caller_name?.trim() || '—';
}

function formatShortDate(iso: string): string {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '—';
    return new Date(t).toLocaleDateString();
}

export function AgingIncidentsDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // Aging view only cares about active tickets by definition. Server-side
    // active filter + page-through avoids the 1000-row silent cutoff.
    const { data, loading, error, refetch } = useIncidents(
        { limit: 1000, states_list: ACTIVE_STATES },
        { fetchAll: true },
    );
    const partial = data?.partial === true;

    // Capture "now" at mount so aging math is stable across re-renders.
    const [now] = useState<number>(() => Date.now());

    // FilterState kept for TopFilterBar's controlled-shell contract;
    // no slicers live here anymore — Region/Country/Location filter
    // owns the only filter state (held in dedicated useStates below).
    const [filters, setFilters] = useState<FilterState>({});
    const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [page, setPage] = useState<{ skip: number; limit: number }>({ skip: 0, limit: PAGE_SIZE });
    const resetPage = () => setPage({ skip: 0, limit: PAGE_SIZE });

    // Base: active + aging > 2d.
    const base: TicketRow[] = useMemo(() => {
        const rows = data?.items ?? [];
        return rows.filter((r) => isActiveState(r.state) && daysSinceUpdated(r, now) > 2);
    }, [data, now]);

    // No panel slicers — the Region/Country/Location filter lives in
    // TopFilterBar's headerSlot.
    const slicers: SlicerConfig[] = useMemo(() => [], []);

    const filtered = useMemo(() => {
        return base.filter((r) =>
            matchesRegionCountry(r, selectedRegions, selectedCountries, selectedLocations, locationForFilter),
        );
    }, [base, selectedRegions, selectedCountries, selectedLocations]);

    const totalActiveFilterCount =
        selectedRegions.length + selectedCountries.length + selectedLocations.length;
    const hasAnyActiveFilter = totalActiveFilterCount > 0;
    function clearEveryFilter() {
        setSelectedRegions([]);
        setSelectedCountries([]);
        setSelectedLocations([]);
        resetPage();
    }

    const enriched: Row[] = useMemo(
        () =>
            filtered.map((r) => ({
                ...r,
                object_type: 'incident' as const,
                _daysNoUpdate: daysSinceUpdated(r, now),
                _openedBy: openedByOf(r),
                _location: locationOf(r),
                _openedFormatted: formatShortDate(r.created_at),
                _updatedAtMs: Date.parse(r.source_updated_at ?? r.updated_at) || 0,
            })),
        [filtered, now],
    );

    // Sort by days-no-update desc so the oldest bubble to the top.
    const sorted = useMemo(
        () => [...enriched].sort((a, b) => b._daysNoUpdate - a._daysNoUpdate),
        [enriched],
    );

    const pageRows = useMemo(
        () => sorted.slice(page.skip, page.skip + page.limit),
        [sorted, page],
    );

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] overflow-hidden p-4 gap-3 ${isLight ? 'bg-slate-50' : ''}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-400'}`}>
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.agingIncidentsTitle')}</h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>
                            {t('pages.agingIncidentsSubtitle')} · {t('pages.agingRecords', { count: sorted.length.toLocaleString() })}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => void refetch()}
                    className={`p-2 rounded-lg border transition-colors ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
                    title={t('empty.retry')}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Filter panel — Region/Country/Location only. Aging is
                already a snapshot of active+stale rows, so there's no
                Open Date / assigned_group / sub-filter beyond geography. */}
            <TopFilterBar
                slicers={slicers}
                value={filters}
                onChange={setFilters}
                storageKey="ops-dashboard:aging-incidents:filters"
                title={t('filters.title')}
                clearLabel={t('filters.clearAll')}
                clientSideTooltip={t('filters.clientSideTooltip')}
                hideHeaderClear
                headerActions={
                    <button
                        type="button"
                        onClick={hasAnyActiveFilter ? clearEveryFilter : undefined}
                        disabled={!hasAnyActiveFilter}
                        className={`text-xs rounded-lg px-3 py-1 border transition-colors ${
                            hasAnyActiveFilter
                                ? isLight
                                    ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100 cursor-pointer'
                                    : 'bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25 cursor-pointer'
                                : isLight
                                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        {t('filters.clearAllFilters')}
                    </button>
                }
                headerSlot={
                    <RegionCountryFilter
                        rows={base}
                        getLocation={locationForFilter}
                        selectedRegions={selectedRegions}
                        selectedCountries={selectedCountries}
                        selectedLocations={selectedLocations}
                        onRegionsChange={(next) => {
                            setSelectedRegions(next);
                            resetPage();
                        }}
                        onCountriesChange={(next) => {
                            setSelectedCountries(next);
                            resetPage();
                        }}
                        onLocationsChange={(next) => {
                            setSelectedLocations(next);
                            resetPage();
                        }}
                        onClearAll={resetPage}
                        showClearButton={false}
                    />
                }
            />

            {/* Table */}
            <div className="flex-1 min-h-0">
                <AgingTable<Row>
                    rows={pageRows}
                    total={sorted.length}
                    skip={page.skip}
                    limit={page.limit}
                    onPageChange={setPage}
                    warnThresholdDays={2}
                    dangerThresholdDays={7}
                    stateBadgeTone="blue"
                    loading={loading}
                    partial={partial}
                    error={error}
                    onRetry={() => void refetch()}
                    pageSize={PAGE_SIZE}
                />
            </div>
        </div>
    );
}
