'use client';

/**
 * Active Monitoring Hub (Page 1.3.10) — active-ticket monitoring page.
 *
 * Data sources:
 *   - useOpsHubReport(...) — single backend aggregate that returns
 *     precomputed KPIs, chart series, and filter options. Replaces the
 *     legacy 4× fetchAll incidents+requests loop that paginated up to 20k
 *     rows per fetch and aggregated everything in the browser.
 *   - useIncidents + useRequests — used ONLY by the collapsible Detail
 *     table, gated on `detailOpen` so the fetch fires the first time the
 *     user expands and never on page load.
 *
 * Predicate contract for every KPI/chart/region count lives in
 * `specs/backend/ops_dashboard_predicates.md`. The frontend's local
 * helpers in `lib/ops_dashboard/aggregate.ts` survive only because the
 * Detail table renders per-row enrichments (request type label, days
 * without update) that the report endpoint doesn't return.
 */

import { useMemo, useState } from 'react';
import { BarChart3, ChevronDown, Loader2, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useIncidents, useRequests } from '@/lib/hooks/useOpsDashboard';
import { useOpsHubReport } from '@/lib/hooks/useOpsHubReport';
import type { TicketRow } from '@/lib/api/ops_dashboard';
import {
    classifyRequestType,
    daysSinceUpdated,
    isActiveState,
    isInScopeGroup,
    openedAt,
    snDayEndIso,
    snDayStartIso,
} from '@/lib/ops_dashboard/aggregate';
import { laDateLabel } from '@/lib/ops_dashboard/tzDate';
import { type Region } from '@/components/ops_dashboard/RegionMap';
import {
    TopFilterBar,
    type FilterState,
} from '@/components/ops_dashboard/filters/TopFilterBar';
import { RegionCountryFilter } from '@/components/ops_dashboard/filters/RegionCountryFilter';
import {
    countryToRegion,
    matchesRegionCountry,
    normalizeRegion,
} from '@/lib/ops_dashboard/region';
import { useOpsGlobalFilter } from '@/lib/hooks/useOpsGlobalFilter';
import { DataTable, type ColDef } from '@/components/ops_dashboard/DataTable';
import { TicketsPanel, type TicketKpiDeltas, type TicketKpis } from './TicketsPanel';
import { TranslatedAutoRefresh } from '@/components/ops_dashboard/TranslatedAutoRefresh';

function locationOf(row: TicketRow): string {
    return row.actor?.location?.descriptor?.trim() || 'Unknown';
}

function regionOf(row: TicketRow): Region {
    // Mirrors `regionOf` in spec §7 — used only for Detail table rows.
    const fromActor = normalizeRegion(row.actor?.location?.region);
    if (fromActor) return fromActor;
    const fromLocation = countryToRegion(row.actor?.location?.descriptor);
    if (fromLocation) return fromLocation;
    const fromGroup = normalizeRegion(row.assigned_group);
    if (fromGroup) return fromGroup;
    return 'OTHER';
}

function locationForFilter(row: TicketRow): string | null {
    return row.actor?.location?.descriptor?.trim() || null;
}

/**
 * Pct-delta string for the 4 MoM-eligible KPI tiles.
 *
 * `previous` of 0 yields `null` (no meaningful baseline — caller renders no
 * delta). Otherwise we shape the result like the legacy `formatMoM`
 * helper so TicketsPanel's render code keeps working unchanged.
 */
function makeDelta(
    current: number,
    previous: number,
): { pct: number; trend: 'up' | 'down' | 'flat'; formatted: string } | null {
    if (previous === 0) return null;
    const pctRaw = ((current - previous) / previous) * 100;
    const pct = Math.round(pctRaw);
    if (pct === 0) return { pct: 0, trend: 'flat', formatted: '0%' };
    const arrow = pct > 0 ? '▲' : '▼';
    return {
        pct,
        trend: pct > 0 ? 'up' : 'down',
        formatted: `${arrow} ${Math.abs(pct)}%`,
    };
}

export function OpsDashboardHub() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // ── Filter state ────────────────────────────────────────────
    const [ticketFilters, setTicketFilters] = useState<FilterState>({
        assigned_group: [],
        location: [],
        priority: [],
    });

    const {
        filter: globalFilter,
        setRegions: setSelectedRegions,
        setCountries: setSelectedCountries,
        setLocations: setSelectedLocations,
    } = useOpsGlobalFilter();
    const selectedRegions = globalFilter.regions;
    const selectedCountries = globalFilter.countries;
    const selectedLocations = globalFilter.locations;

    const ticketDateRange =
        (ticketFilters.created_at_from as { from: string | null; to: string | null } | undefined) ??
        { from: null, to: null };
    const ticketDateFromIso = snDayStartIso(ticketDateRange.from);
    const ticketDateToIso = snDayEndIso(ticketDateRange.to);

    // Donut-driven chart filters surfaced to the user via TopFilterBar.
    // Wrapped in their own useMemos because they're read as deps by both
    // the report fetch AND the Detail-table filter pass — re-creating the
    // array each render would invalidate downstream memoization.
    const groupSel = useMemo<string[]>(
        () => (ticketFilters.assigned_group as string[]) ?? [],
        [ticketFilters.assigned_group],
    );
    const locSel = useMemo<string[]>(
        () => (ticketFilters.location as string[]) ?? [],
        [ticketFilters.location],
    );
    const prioSel = useMemo<string[]>(
        () => (ticketFilters.priority as string[]) ?? [],
        [ticketFilters.priority],
    );

    // Union the explicit Location dropdown selections with any locations
    // toggled from the chart-side filter — both narrow the same dimension
    // server-side. Same union shape was implicit in the legacy AND-chain.
    const allLocationFilters = useMemo(
        () => Array.from(new Set([...selectedLocations, ...locSel])),
        [selectedLocations, locSel],
    );

    // ── Main report fetch ──────────────────────────────────────
    const reportQuery = useOpsHubReport({
        source_created_at_from: ticketDateFromIso,
        source_created_at_to: ticketDateToIso,
        region_in: selectedRegions.length ? selectedRegions : undefined,
        country_in: selectedCountries.length ? selectedCountries : undefined,
        location_in: allLocationFilters.length ? allLocationFilters : undefined,
        assigned_group_in: groupSel.length ? groupSel : undefined,
        priority_in: prioSel.length ? prioSel : undefined,
    });
    const report = reportQuery.data;

    const loading = reportQuery.loading;
    const partial = report?.meta.partial === true;
    const error = reportQuery.error;

    // ── Detail table (lazy: only fetches when expanded) ────────
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailPage, setDetailPage] = useState<{ skip: number; limit: number }>(
        { skip: 0, limit: 50 },
    );

    const incidentQuery = useIncidents(
        {
            limit: 1000,
            view: 'slim',
            source_created_at_from: ticketDateFromIso,
            source_created_at_to: ticketDateToIso,
        },
        { fetchAll: true, enabled: detailOpen },
    );
    const requestQuery = useRequests(
        {
            limit: 1000,
            view: 'slim',
            source_created_at_from: ticketDateFromIso,
            source_created_at_to: ticketDateToIso,
        },
        { fetchAll: true, enabled: detailOpen },
    );

    const refetchAll = async () => {
        const tasks: Array<Promise<unknown>> = [reportQuery.refetch()];
        if (detailOpen) {
            tasks.push(incidentQuery.refetch());
            tasks.push(requestQuery.refetch());
        }
        await Promise.all(tasks);
    };

    // The Detail table owns its own lazy fetch, so it needs its own status.
    // Without these the table renders the same "no records" cell whether the
    // two `fetchAll` scans are still paginating or the request failed — and an
    // unfiltered scan of both tables takes long enough that the empty cell
    // reads as "there is no data" rather than "still working".
    const detailLoading = incidentQuery.loading || requestQuery.loading;
    const detailPartial =
        incidentQuery.data?.partial === true || requestQuery.data?.partial === true;
    const detailError = incidentQuery.error ?? requestQuery.error;

    // Stable clock for the Detail table's aging math.
    const [now] = useState<number>(() => Date.now());

    // ── Derived: per-row Detail rows (only computed when expanded) ──
    const allTickets: TicketRow[] = useMemo(() => {
        if (!detailOpen) return [];
        const a = incidentQuery.data?.items ?? [];
        const b = requestQuery.data?.items ?? [];
        return [...a, ...b];
    }, [detailOpen, incidentQuery.data, requestQuery.data]);

    const filteredDetailTickets = useMemo(() => {
        if (!detailOpen) return [];
        return allTickets.filter((r) => {
            if (!matchesRegionCountry(r, selectedRegions, selectedCountries, allLocationFilters, locationForFilter)) return false;
            if (groupSel.length && !groupSel.includes(r.assigned_group ?? 'Unknown')) return false;
            if (prioSel.length && !prioSel.includes(r.priority)) return false;
            return true;
        });
    }, [detailOpen, allTickets, selectedRegions, selectedCountries, allLocationFilters, groupSel, prioSel]);

    const activeDetailTickets = useMemo(
        () =>
            filteredDetailTickets.filter(
                (r) => isActiveState(r.state) && isInScopeGroup(r.assigned_group),
            ),
        [filteredDetailTickets],
    );

    // ── KPI extraction — direct read from the report block ────
    // Narrow nested-property deps in the useMemos below — the React
    // Compiler infers the deepest path used and skips memoization when
    // the declared dep array is coarser. Pulling these out keeps the
    // compiler happy without changing semantics.
    const reportKpis = report?.current.kpis;
    const reportPrevKpis = report?.previous.kpis;
    const reportGroupDonut = report?.current.charts.group_donut;
    const reportAssigneeBar = report?.current.charts.assignee_bar;
    const reportRegion = report?.current.charts.region;
    const reportLocations = report?.current.filter_options.locations;

    const ticketKpis: TicketKpis = useMemo(() => {
        if (!reportKpis) {
            return {
                totalActive: 0,
                activeIncident: 0,
                activeIncidentHigh: 0,
                activeCatalog: 0,
                activeAsset: 0,
                vipActive: 0,
                unassigned: 0,
                agingIncidentGt2d: 0,
                agingCatalogGt30d: 0,
                agingAssetGt30d: 0,
            };
        }
        return { ...reportKpis };
    }, [reportKpis]);

    const ticketKpiDeltas: TicketKpiDeltas = useMemo(() => {
        if (!reportKpis || !reportPrevKpis) {
            return {
                totalActive: null,
                activeIncident: null,
                activeCatalog: null,
                activeAsset: null,
                vipActive: null,
            };
        }
        return {
            totalActive: makeDelta(reportKpis.totalActive, reportPrevKpis.totalActive),
            activeIncident: makeDelta(reportKpis.activeIncident, reportPrevKpis.activeIncident),
            activeCatalog: makeDelta(reportKpis.activeCatalog, reportPrevKpis.activeCatalog),
            activeAsset: makeDelta(reportKpis.activeAsset, reportPrevKpis.activeAsset),
            // VIP MoM intentionally null — spec §8: backend doesn't replay
            // VIP membership history yet. Adding it is a non-breaking
            // schema extension when the backend ships it.
            vipActive: null,
        };
    }, [reportKpis, reportPrevKpis]);

    // ── Chart data — direct read ──────────────────────────────
    const groupDonut = useMemo(
        () => reportGroupDonut ?? [],
        [reportGroupDonut],
    );
    const assigneeBar = useMemo(
        () =>
            (reportAssigneeBar ?? []).map((row) => ({
                key: row.key,
                count: row.count,
            })),
        [reportAssigneeBar],
    );
    const regionData = useMemo(
        () =>
            (reportRegion ?? []).map((row) => ({
                region: row.region as Region,
                count: row.count,
            })),
        [reportRegion],
    );

    // ── RegionCountryFilter feed — distinct locations the backend saw
    //   on the current active+in-scope set. Saves us materialising
    //   `regionCountryRows` from a 20k-row in-browser allTickets array. ──
    const regionCountryRows = useMemo(() => {
        return (reportLocations ?? []).map((loc) => ({ location: loc }));
    }, [reportLocations]);

    // ── Detail table rows ─────────────────────────────────────
    interface DetailRow extends Record<string, unknown> {
        oid: string;
        stable_id: string;
        object_type: 'incident' | 'request';
        title: string | null;
        state: string;
        priority: string;
        assigned_group: string | null;
        assigned_to_name: string | null;
        _type: 'incident' | 'request';
        _typeLabel: string;
        _daysNoUpdate: number;
        _location: string;
        _region: Region;
        _openedAt: string;
        _openedBy: string;
    }
    const detailRows: DetailRow[] = useMemo(() => {
        if (!detailOpen) return [];
        return activeDetailTickets.map((r) => {
            const typeKey: 'incident' | 'request' = r.object_type === 'incident' ? 'incident' : 'request';
            let typeLabel: string;
            if (typeKey === 'incident') typeLabel = t('tables.incident');
            else {
                const rt = classifyRequestType(r);
                typeLabel =
                    rt === 'asset_task' ? t('tables.assetTask')
                        : rt === 'catalog_task' ? t('tables.catalogTask')
                            : t('tables.request');
            }
            const opened = openedAt(r);
            return {
                oid: r.oid,
                stable_id: r.stable_id,
                object_type: typeKey,
                title: r.title,
                state: r.state,
                priority: r.priority,
                assigned_group: r.assigned_group,
                assigned_to_name: r.assigned_to_name,
                _type: typeKey,
                _typeLabel: typeLabel,
                _daysNoUpdate: daysSinceUpdated(r, now),
                _location: locationOf(r),
                _region: regionOf(r),
                _openedAt: opened,
                _openedBy: r.actor?.fullname?.trim() || r.caller_name?.trim() || '—',
            };
        });
    }, [detailOpen, activeDetailTickets, now, t]);

    const detailTotal = activeDetailTickets.length;
    const effectiveSkip = detailPage.skip >= detailTotal ? 0 : detailPage.skip;
    const detailPageRows = useMemo(
        () => detailRows.slice(effectiveSkip, effectiveSkip + detailPage.limit),
        [detailRows, effectiveSkip, detailPage.limit],
    );

    const detailCols: ColDef<DetailRow>[] = useMemo(() => {
        const badgeCls = (type: 'incident' | 'request') =>
            type === 'incident'
                ? isLight ? 'bg-red-50 text-red-700' : 'bg-red-500/15 text-red-300'
                : isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-500/15 text-blue-300';
        return [
            {
                key: 'stable_id',
                label: t('tables.number'),
                width: '120px',
                render: (r) => <span className="font-mono text-blue-400">{r.stable_id}</span>,
            },
            {
                key: '_typeLabel',
                label: t('tables.type'),
                width: '110px',
                render: (r) => (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${badgeCls(r._type)}`}>
                        {r._typeLabel}
                    </span>
                ),
            },
            { key: 'state', label: t('tables.state'), width: '130px' },
            { key: 'priority', label: t('tables.priority'), width: '90px' },
            {
                key: '_daysNoUpdate',
                label: t('tables.daysNoUpdate'),
                width: '110px',
                render: (r) => {
                    const cls = r._daysNoUpdate > 7 ? 'text-red-400 font-bold'
                        : r._daysNoUpdate > 2 ? 'text-orange-400 font-semibold' : '';
                    return <span className={cls}>{r._daysNoUpdate}d</span>;
                },
                sortValue: (r) => r._daysNoUpdate,
                csvValue: (r) => r._daysNoUpdate,
            },
            { key: 'assigned_group', label: t('tables.assignmentGroup'), width: '170px', render: (r) => r.assigned_group ?? '—' },
            { key: 'assigned_to_name', label: t('tables.assignedTo'), width: '140px', render: (r) => r.assigned_to_name ?? '—' },
            { key: '_openedBy', label: t('tables.openedBy'), width: '140px' },
            { key: '_region', label: t('tables.region'), width: '90px' },
            { key: '_location', label: t('tables.location'), width: '150px' },
            {
                key: '_openedAt',
                label: t('tables.openedAt'),
                width: '110px',
                render: (r) => laDateLabel(r._openedAt),
                sortValue: (r) => r._openedAt,
                csvValue: (r) => laDateLabel(r._openedAt),
            },
            {
                key: 'title',
                label: t('tables.title'),
                width: '360px',
                render: (r) => <span className="truncate block" title={r.title ?? ''}>{r.title ?? ''}</span>,
            },
        ];
    }, [isLight, t]);

    // ── Cross-filter handlers ───────────────────────────────────
    const toggleTicketFilter = (param: string, name: string) => {
        const cur = (ticketFilters[param] as string[]) ?? [];
        const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
        setTicketFilters({ ...ticketFilters, [param]: next });
    };
    const onGroupSliceClick = (slice: { name: string }) => toggleTicketFilter('assigned_group', slice.name);
    const onGroupLegendToggle = (name: string) => toggleTicketFilter('assigned_group', name);

    const selectedAssignedGroups = (ticketFilters.assigned_group as string[]) ?? [];

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';

    // ── "filtered / total" denominator — the report endpoint always returns
    //   the FILTERED current count in `totalActive`. For the unfiltered
    //   total we issue NO second fetch — the header label drops the total
    //   when no filters are applied (it just shows the filtered count),
    //   which is the only state in which the comparison is meaningless.
    const totalActiveCount = ticketKpis.totalActive;

    // ── Consolidated Clear All ─────────────────────────────────
    const extraActiveFilterCount = useMemo(() => {
        let n = 0;
        const arr = (s: FilterState, k: string) => (Array.isArray(s[k]) ? (s[k] as string[]).length : 0);
        n += arr(ticketFilters, 'assigned_group');
        n += arr(ticketFilters, 'priority');
        n += arr(ticketFilters, 'location');
        return n;
    }, [ticketFilters]);

    function resetAllParentFilters() {
        setTicketFilters({
            assigned_group: [],
            location: [],
            priority: [],
        });
    }

    const totalActiveFilterCount =
        selectedRegions.length +
        selectedCountries.length +
        selectedLocations.length +
        extraActiveFilterCount;
    const hasAnyActiveFilter = totalActiveFilterCount > 0;
    function clearEveryFilter() {
        setSelectedRegions([]);
        setSelectedCountries([]);
        setSelectedLocations([]);
        resetAllParentFilters();
    }

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] overflow-hidden p-4 gap-3 ${isLight ? 'bg-slate-50' : ''}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-400'}`}>
                        <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.hubTitle')}</h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>{t('pages.hubSubtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <TranslatedAutoRefresh onRefresh={() => void refetchAll()} storageKey="ops-dashboard:hub:auto-refresh" />
                    <button
                        onClick={() => void refetchAll()}
                        className={`p-2 rounded-lg border transition-colors ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
                        title={t('empty.retry')}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <TopFilterBar
                value={ticketFilters}
                onChange={setTicketFilters}
                storageKey="ops-dashboard:hub:filters"
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
                        rows={regionCountryRows}
                        getLocation={(r) => r.location}
                        selectedRegions={selectedRegions}
                        selectedCountries={selectedCountries}
                        selectedLocations={selectedLocations}
                        onRegionsChange={setSelectedRegions}
                        onCountriesChange={setSelectedCountries}
                        onLocationsChange={setSelectedLocations}
                        extraActiveCount={extraActiveFilterCount}
                        onClearAll={resetAllParentFilters}
                        showClearButton={false}
                    />
                }
            />

            <div className="flex-1 min-h-0 overflow-auto">
                {partial && (
                    <div className={`rounded-xl border p-3 mb-3 text-xs flex items-center gap-2 ${isLight ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                        <span>{t('empty.partialResult')}</span>
                        <button onClick={() => void refetchAll()} className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${isLight ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200'}`}>{t('empty.retry')}</button>
                    </div>
                )}
                {error && !partial && (
                    <div className={`rounded-xl border p-3 mb-3 text-xs flex items-center gap-2 ${isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                        <span>{error}</span>
                        <button onClick={() => void refetchAll()} className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${isLight ? 'bg-red-100 hover:bg-red-200 text-red-800' : 'bg-red-500/20 hover:bg-red-500/30 text-red-200'}`}>{t('empty.retry')}</button>
                    </div>
                )}

                <TicketsPanel
                    kpis={ticketKpis}
                    kpiDeltas={ticketKpiDeltas}
                    groupDonut={groupDonut}
                    assigneeBar={assigneeBar}
                    trend={[]}
                    trendMonths={0}
                    regionData={regionData}
                    loading={loading}
                    filteredCount={ticketKpis.totalActive}
                    totalActiveCount={totalActiveCount}
                    onGroupSliceClick={onGroupSliceClick}
                    selectedGroups={selectedAssignedGroups}
                    onGroupLegendToggle={onGroupLegendToggle}
                />

                {/* Collapsible Detail table — lazy: useIncidents+useRequests
                    fire the first time the user opens it, gated via
                    `enabled: detailOpen`. */}
                <details
                    className={`mt-3 rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}
                    open={detailOpen}
                    onToggle={(e) => setDetailOpen((e.currentTarget as HTMLDetailsElement).open)}
                >
                    <summary
                        className={`list-none cursor-pointer select-none px-4 py-3 flex items-center justify-between ${textMain}`}
                    >
                        <span className="flex items-center gap-2 text-sm font-medium">
                            <ChevronDown
                                className={`w-4 h-4 transition-transform ${detailOpen ? 'rotate-0' : '-rotate-90'}`}
                            />
                            {t('tables.detailTitle')}
                        </span>
                        <span className={`text-xs flex items-center gap-1.5 ${textMuted}`}>
                            {detailOpen && detailLoading && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                            )}
                            {detailOpen && detailLoading
                                ? t('empty.loading')
                                : t('pages.unassignedRecords', { count: detailTotal.toLocaleString() })}
                        </span>
                    </summary>
                    {detailOpen && (
                        <div className="px-4 pb-4">
                            <DataTable<DetailRow>
                                rows={detailPageRows}
                                cols={detailCols}
                                searchKeys={['stable_id', 'title', 'assigned_to_name', 'assigned_group', '_openedBy'] as (keyof DetailRow)[]}
                                total={detailTotal}
                                skip={effectiveSkip}
                                limit={detailPage.limit}
                                onPageChange={(next) => setDetailPage(next)}
                                loading={detailLoading}
                                partial={detailPartial}
                                error={detailError}
                                onRetry={() => void refetchAll()}
                                emptyText={t('empty.noData')}
                                loadingText={t('empty.loading')}
                                partialText={t('empty.partialResult')}
                                csvRows={detailRows}
                                csvFilename="active_monitoring_tickets"
                            />
                        </div>
                    )}
                </details>
            </div>
        </div>
    );
}
