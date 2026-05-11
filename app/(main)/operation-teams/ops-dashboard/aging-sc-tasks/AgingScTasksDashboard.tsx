'use client';

/**
 * Aging SC Tasks (Page 1.3.8) — ports `temp_ref/.../dashboard/aging-sc-tasks/AgingScTasksPage.tsx`.
 *
 * Structurally identical to Aging Incidents but for requests classified
 * as `catalog_task` via the Phase 1 client-side heuristic. Thresholds
 * shift to 30d warn / 60d danger, and the state badge uses the cyan
 * tone the prototype used to visually separate SC tasks from incidents.
 */

import { useMemo, useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useRequests } from '@/lib/hooks/useOpsDashboard';
import type { TicketRow } from '@/lib/api/ops_dashboard';
import {
    ACTIVE_STATES,
    classifyRequestType,
    daysSinceUpdated,
    isActiveState,
} from '@/lib/ops_dashboard/aggregate';
import {
    AgingTable,
    type AgingTableRow,
} from '@/components/ops_dashboard/AgingTable';
import { ClassifierCaveatFooter } from '@/components/ops_dashboard/ClassifierCaveatFooter';
import {
    TopFilterBar,
    type FilterState,
    type SlicerConfig,
} from '@/components/ops_dashboard/filters/TopFilterBar';
import { RegionCountryFilter } from '@/components/ops_dashboard/filters/RegionCountryFilter';
import type { Region } from '@/components/ops_dashboard/RegionMap';
import { matchesRegionCountry } from '@/lib/ops_dashboard/region';
import { useOpsGlobalFilter } from '@/lib/hooks/useOpsGlobalFilter';

const PAGE_SIZE = 100;

interface Row extends AgingTableRow {
    object_type: 'request';
    created_at: string;
    updated_at: string;
}

function locationOf(row: TicketRow): string {
    return row.actor?.location?.descriptor?.trim() || '—';
}

/** RegionCountryFilter wants null on missing locations. */
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

export function AgingScTasksDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const { data, loading, error, refetch } = useRequests(
        { limit: 1000, states_list: ACTIVE_STATES },
        { fetchAll: true },
    );
    const partial = data?.partial === true;

    const [now] = useState<number>(() => Date.now());

    const [filters, setFilters] = useState<FilterState>({});
    // Region / Country / Location are SHARED across every MONITORING
    // dashboard via useOpsGlobalFilter — picking AMER on one page
    // carries the selection to the others so users don't repeat it.
    const {
        filter: globalFilter,
        setRegions: setSelectedRegions,
        setCountries: setSelectedCountries,
        setLocations: setSelectedLocations,
    } = useOpsGlobalFilter();
    const selectedRegions = globalFilter.regions;
    const selectedCountries = globalFilter.countries;
    const selectedLocations = globalFilter.locations;
    const [page, setPage] = useState<{ skip: number; limit: number }>({ skip: 0, limit: PAGE_SIZE });
    const resetPage = () => setPage({ skip: 0, limit: PAGE_SIZE });

    // Base: catalog tasks + active + aging > 30d.
    const base: TicketRow[] = useMemo(() => {
        const rows = data?.items ?? [];
        return rows.filter(
            (r) =>
                classifyRequestType(r) === 'catalog_task' &&
                isActiveState(r.state) &&
                daysSinceUpdated(r, now) > 30,
        );
    }, [data, now]);

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
                object_type: 'request' as const,
                _daysNoUpdate: daysSinceUpdated(r, now),
                _openedBy: openedByOf(r),
                _location: locationOf(r),
                _openedFormatted: formatShortDate(r.created_at),
                _updatedAtMs: Date.parse(r.source_updated_at ?? r.updated_at) || 0,
            })),
        [filtered, now],
    );

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
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-cyan-100 text-cyan-600' : 'bg-cyan-500/20 text-cyan-400'}`}>
                        <Clock className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.agingScTasksTitle')}</h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>
                            {t('pages.agingScTasksSubtitle')} · {t('pages.agingRecords', { count: sorted.length.toLocaleString() })}
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

            <TopFilterBar
                slicers={slicers}
                value={filters}
                onChange={setFilters}
                storageKey="ops-dashboard:aging-sc-tasks:filters"
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

            <div className="flex-1 min-h-0">
                <AgingTable<Row>
                    rows={pageRows}
                    total={sorted.length}
                    skip={page.skip}
                    limit={page.limit}
                    onPageChange={setPage}
                    warnThresholdDays={30}
                    dangerThresholdDays={60}
                    stateBadgeTone="cyan"
                    loading={loading}
                    partial={partial}
                    error={error}
                    onRetry={() => void refetch()}
                    pageSize={PAGE_SIZE}
                />
            </div>

            <ClassifierCaveatFooter />
        </div>
    );
}
