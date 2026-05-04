'use client';

/**
 * VIP Tickets (Page 1.3.5) — ports `temp_ref/.../dashboard/vip-tickets/VipTicketsPage.tsx`.
 *
 * The VIP cohort spans both incidents and requests. We fetch both with
 * `is_vip=true`, merge, and run an active-state client
 * filter to keep Phase 1's contract. Each endpoint caps at 1000 rows —
 * the merged union gives us up to 2000 tickets, which comfortably
 * covers the current VIP volume; flagged as a known ceiling if it ever
 * spills over.
 *
 * Pagination is client-side (slice the merged array). The DataTable
 * primitive is designed for server-side pagination but accepts a
 * client-side workflow as long as we pass `total = merged.length` and
 * hold the `skip/limit` state locally.
 */

import { useMemo, useState } from 'react';
import { Star, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useIncidents, useRequests } from '@/lib/hooks/useOpsDashboard';
import type { TicketRow } from '@/lib/api/ops_dashboard';
import { ACTIVE_STATES, daysSinceUpdated, isActiveState } from '@/lib/ops_dashboard/aggregate';
import { DataTable, type ColDef } from '@/components/ops_dashboard/DataTable';
import {
    TopFilterBar,
    type FilterState,
    type SlicerConfig,
} from '@/components/ops_dashboard/filters/TopFilterBar';
import { RegionCountryFilter } from '@/components/ops_dashboard/filters/RegionCountryFilter';
import type { Region } from '@/components/ops_dashboard/RegionMap';
import { matchesRegionCountry } from '@/lib/ops_dashboard/region';

const PAGE_SIZE = 100;

interface VipTableRow extends Record<string, unknown> {
    oid: string;
    stable_id: string;
    object_type: 'incident' | 'request';
    title: string;
    state: string;
    priority: string;
    assigned_group: string | null;
    assigned_to_name: string | null;
    caller_name: string | null;
    _typeLabel: string;
    _daysNoUpdate: number;
    _openedBy: string;
    _location: string;
    _openedFormatted: string;
    _updatedAtMs: number;
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

export function VipTicketsDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // Fetch both endpoints in parallel — both filtered by is_vip + OIT +
    // active-only (VIP page only shows open tickets). fetchAll pages
    // through so we don't silently drop older VIP tickets past the first 1000.
    const incidentQuery = useIncidents(
        { limit: 1000, is_vip: true, states_list: ACTIVE_STATES },
        { fetchAll: true },
    );
    const requestQuery = useRequests(
        { limit: 1000, is_vip: true, states_list: ACTIVE_STATES },
        { fetchAll: true },
    );

    const loading = incidentQuery.loading || requestQuery.loading;
    const partial = incidentQuery.data?.partial === true || requestQuery.data?.partial === true;
    const error = incidentQuery.error ?? requestQuery.error;
    const refetch = async () => {
        await Promise.all([incidentQuery.refetch(), requestQuery.refetch()]);
    };

    // Capture "now" at mount so aging math is stable across re-renders
    // (react-hooks/purity rejects Date.now() inside useMemo).
    const [now] = useState<number>(() => Date.now());

    // FilterState kept for TopFilterBar's controlled-shell contract;
    // the Region/Country/Location filter owns the only filter state.
    const [filters, setFilters] = useState<FilterState>({});
    const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
    const [page, setPage] = useState<{ skip: number; limit: number }>({ skip: 0, limit: PAGE_SIZE });
    const resetPage = () => setPage({ skip: 0, limit: PAGE_SIZE });

    // Merge, narrow to active states, sort by source_updated_at DESC
    // (Phase 2 aging clock; fall back to updated_at on pre-backfill rows
    // or non-SN activity sources).
    const merged: TicketRow[] = useMemo(() => {
        const a = incidentQuery.data?.items ?? [];
        const b = requestQuery.data?.items ?? [];
        const seen = new Set<string>();
        const all: TicketRow[] = [];
        for (const row of [...a, ...b]) {
            if (!isActiveState(row.state)) continue;
            if (seen.has(row.oid)) continue;
            seen.add(row.oid);
            all.push(row);
        }
        all.sort(
            (x, y) =>
                Date.parse(y.source_updated_at ?? y.updated_at) -
                Date.parse(x.source_updated_at ?? x.updated_at),
        );
        return all;
    }, [incidentQuery.data, requestQuery.data]);

    // No panel slicers — Region/Country/Location filter lives in
    // TopFilterBar's headerSlot.
    const slicers: SlicerConfig[] = useMemo(() => [], []);

    const filtered = useMemo(() => {
        return merged.filter((r) =>
            matchesRegionCountry(r, selectedRegions, selectedCountries, selectedLocations, locationForFilter),
        );
    }, [merged, selectedRegions, selectedCountries, selectedLocations]);

    const totalActiveFilterCount =
        selectedRegions.length + selectedCountries.length + selectedLocations.length;
    const hasAnyActiveFilter = totalActiveFilterCount > 0;
    function clearEveryFilter() {
        setSelectedRegions([]);
        setSelectedCountries([]);
        setSelectedLocations([]);
        resetPage();
    }

    const enriched: VipTableRow[] = useMemo(
        () =>
            filtered.map((r) => ({
                ...r,
                _typeLabel: r.object_type === 'incident' ? t('tables.incident') : t('tables.request'),
                _daysNoUpdate: daysSinceUpdated(r, now),
                _openedBy: openedByOf(r),
                _location: locationOf(r),
                _openedFormatted: formatShortDate(r.created_at),
                _updatedAtMs: Date.parse(r.source_updated_at ?? r.updated_at) || 0,
            })),
        [filtered, now, t],
    );

    const pageRows = useMemo(
        () => enriched.slice(page.skip, page.skip + page.limit),
        [enriched, page],
    );

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';

    const cols: ColDef<VipTableRow>[] = useMemo(() => {
        const typeBadgeCls = (type: 'incident' | 'request') =>
            type === 'incident'
                ? isLight
                    ? 'bg-red-50 text-red-700'
                    : 'bg-red-500/15 text-red-300'
                : isLight
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-blue-500/15 text-blue-300';
        return [
            {
                key: 'stable_id',
                label: t('tables.number'),
                width: '130px',
                render: (r) => <span className="font-mono text-blue-400">{r.stable_id}</span>,
            },
            {
                key: '_typeLabel',
                label: t('tables.type'),
                width: '100px',
                render: (r) => (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${typeBadgeCls(r.object_type)}`}>
                        {r._typeLabel}
                    </span>
                ),
            },
            { key: 'state', label: t('tables.state'), width: '130px' },
            {
                key: '_daysNoUpdate',
                label: t('tables.daysNoUpdate'),
                width: '110px',
                render: (r) => {
                    const cls = r._daysNoUpdate > 7 ? 'text-red-400 font-bold' : r._daysNoUpdate > 2 ? 'text-orange-400 font-semibold' : '';
                    return <span className={cls}>{r._daysNoUpdate}d</span>;
                },
                sortValue: (r) => r._daysNoUpdate,
            },
            { key: 'priority', label: t('tables.priority'), width: '100px' },
            { key: 'assigned_group', label: t('tables.assignmentGroup'), width: '160px', render: (r) => r.assigned_group ?? '—' },
            { key: 'assigned_to_name', label: t('tables.assignedTo'), width: '150px', render: (r) => r.assigned_to_name ?? '—' },
            { key: '_openedBy', label: t('tables.openedBy'), width: '150px' },
            { key: '_location', label: t('tables.location'), width: '140px' },
            {
                key: '_openedFormatted',
                label: t('tables.openedAt'),
                width: '110px',
                sortValue: (r) => Date.parse(String((r as unknown as { created_at: string }).created_at)) || 0,
            },
            { key: 'title', label: t('tables.shortDescription') },
        ];
    }, [t, isLight]);

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] overflow-hidden p-4 gap-3 ${isLight ? 'bg-slate-50' : ''}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400'}`}>
                        <Star className="w-5 h-5 fill-current" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.vipTitle')}</h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>
                            {t('pages.vipSubtitle')} · {t('pages.vipRecords', { count: filtered.length.toLocaleString() })}
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

            {/* Filter panel — Region/Country/Location only. VIP page
                shows active VIP tickets across incidents + requests
                (no Open Date / sub-filters beyond geography). */}
            <TopFilterBar
                slicers={slicers}
                value={filters}
                onChange={setFilters}
                storageKey="ops-dashboard:vip-tickets:filters"
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
                        Clear All Filters
                    </button>
                }
                headerSlot={
                    <RegionCountryFilter
                        rows={merged}
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
                <DataTable<VipTableRow>
                    rows={pageRows}
                    cols={cols}
                    searchKeys={['stable_id', 'title', 'assigned_to_name', '_openedBy'] as (keyof VipTableRow)[]}
                    total={enriched.length}
                    skip={page.skip}
                    limit={page.limit}
                    onPageChange={setPage}
                    loading={loading}
                    partial={partial}
                    error={error}
                    onRetry={() => void refetch()}
                    emptyText={t('empty.noData')}
                    loadingText={t('empty.loading')}
                    partialText={t('empty.partialResult')}
                    pageSizeOptions={[50, 100, 200, 500]}
                />
            </div>
        </div>
    );
}
