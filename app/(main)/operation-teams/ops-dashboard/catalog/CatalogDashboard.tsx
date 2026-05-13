'use client';

/**
 * Catalog Task Dashboard (Page 1.3.7) — ports `temp_ref/.../dashboard/catalog/CatalogDashboardPage.tsx`.
 *
 * Base filter: requests where `classifyRequestType(row) === 'catalog_task'`.
 * That's a Phase 1 client-side heuristic — a server-side `request_type`
 * column lands in Phase 2 and will supersede it. The amber footer in
 * the sidebar explains this to the user so they understand why a few
 * rows may look misclassified.
 *
 * KPIs, donuts, bar chart, and trend line are all derived in-browser
 * from the slim request list (limit=1000) — no aggregation endpoint
 * exists yet.
 */

import { useCallback, useMemo, useState } from 'react';
import { ShoppingCart, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useRequests } from '@/lib/hooks/useOpsDashboard';
import type { TicketRow } from '@/lib/api/ops_dashboard';
import {
    classifyRequestType,
    cumulativeTrendByMonth,
    trendByMonth,
    daysSinceUpdated,
    formatDurationSec,
    formatMoM,
    groupBy,
    isActiveState,
    meanOf,
    momActiveSnapshot,
    momByDate,
    monthsFromRange,
    openedAt,
    sumOf,
    type DeltaInfo,
} from '@/lib/ops_dashboard/aggregate';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { GroupBarCard } from '@/components/ops_dashboard/GroupBarCard';
import { TrendLineCard } from '@/components/ops_dashboard/TrendLineCard';
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
import { TranslatedAutoRefresh } from '@/components/ops_dashboard/TranslatedAutoRefresh';

/** Catalog tasks use the prototype's blue-family palette to distinguish them from incidents. */
const CATALOG_PALETTE = [
    '#0ea5e9',
    '#06b6d4',
    '#0891b2',
    '#0284c7',
    '#1d4ed8',
    '#2563eb',
    '#3b82f6',
    '#0369a1',
];

/** Country/location string used by RegionCountryFilter — null when unresolved. */
function locationForFilter(row: TicketRow): string | null {
    return row.actor?.location?.descriptor?.trim() || null;
}

function departmentOf(row: TicketRow): string {
    return row.actor?.organization?.descriptor?.trim() || 'Unknown';
}

function openedDateStr(row: TicketRow): string {
    // Use upstream SN open date (source_created_at) per the ops-team
    // contract; fall back to local created_at when missing.
    return openedAt(row).slice(0, 10);
}

/** Trim a long department/group label to fit the horizontal bar chart. */
function trimLabel(label: string, max = 22): string {
    return label.length > max ? `${label.slice(0, max)}…` : label;
}

export function CatalogDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const deltaLabel = (d: DeltaInfo) =>
        d.trend === 'flat'
            ? t('kpis.momFlat')
            : t('kpis.momDelta', { arrow: d.trend === 'up' ? '▲' : '▼', pct: Math.abs(d.pct) });

    // 3-month default seeded into the user-visible filter so the picker
    // reflects what's actually being fetched. Otherwise users see a date
    // gap and mistake it for a server-side cutoff.
    // Default Open-date filter starts at the FIRST DAY OF THE
    // CURRENT MONTH so all MONITORING dashboards open on the
    // same month-to-date window — easier to compare numbers
    // across pages and matches how the team reports MTD.
    const [defaultFromIso] = useState<string>(() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}-01`;
    });

    // Stable aging clock.
    const [now] = useState<number>(() => Date.now());

    const [filters, setFilters] = useState<FilterState>({
        // assigned_group / state are donut-driven chart filters now;
        // department / location dropped (replaced by Region/Country).
        assigned_group: [],
        state: [],
        created_at_from: { from: defaultFromIso, to: null },
        created_at_to: { from: defaultFromIso, to: null },
    });

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

    const dateRange = (filters.created_at_from as { from: string | null; to: string | null } | undefined) ?? { from: null, to: null };
    const { data, loading, error, refetch } = useRequests(
        {
            limit: 1000,
            created_at_from: dateRange.from ?? undefined,
            created_at_to: dateRange.to ?? undefined,
        },
        { fetchAll: true },
    );
    const partial = data?.partial === true;

    // Narrow to catalog tasks (Phase 1 heuristic).
    const catalogRows: TicketRow[] = useMemo(() => {
        const rows = data?.items ?? [];
        return rows.filter((r) => classifyRequestType(r) === 'catalog_task');
    }, [data]);

    // Region/Country live in the panel headerSlot; donut clicks drive
    // assigned_group + state. Open Date is the only remaining slicer.
    const slicers: SlicerConfig[] = useMemo(
        () => [
            { type: 'date-range', param: ['created_at_from', 'created_at_to'], label: t('filters.opened') },
        ],
        [t],
    );

    const filtered = useMemo(() => {
        const groupSel = (filters.assigned_group as string[]) ?? [];
        const stateSel = (filters.state as string[]) ?? [];
        const range = (filters.created_at_from as { from: string | null; to: string | null }) ?? { from: null, to: null };
        return catalogRows.filter((r) => {
            if (!matchesRegionCountry(r, selectedRegions, selectedCountries, selectedLocations, locationForFilter)) return false;
            if (groupSel.length && !groupSel.includes(r.assigned_group ?? 'Unknown')) return false;
            if (stateSel.length && !stateSel.includes(r.state)) return false;
            if (range.from || range.to) {
                const opened = openedDateStr(r);
                if (range.from && opened && opened < range.from) return false;
                if (range.to && opened && opened > range.to) return false;
            }
            return true;
        });
    }, [catalogRows, filters, selectedRegions, selectedCountries, selectedLocations]);

    const activeRows = useMemo(() => filtered.filter((r) => isActiveState(r.state)), [filtered]);

    // Month-over-month delta for the volume + active KPIs.
    const totalMoM = useMemo(
        () => formatMoM(momByDate(filtered, (r) => openedAt(r), now)),
        [filtered, now],
    );
    const activeMoM = useMemo(
        () => formatMoM(momActiveSnapshot(filtered, now)),
        [filtered, now],
    );

    const kpis = useMemo(() => {
        const total = filtered.length;
        const active = activeRows.length;
        const resolved = total - active;
        const resolvedRate = total > 0 ? `${((resolved / total) * 100).toFixed(1)}%` : '—';
        let aging7d = 0;
        let aging30d = 0;
        for (const r of activeRows) {
            const days = daysSinceUpdated(r, now);
            if (days > 7) aging7d += 1;
            if (days > 30) aging30d += 1;
        }

        // Resolved-on-day-1 and time metrics — mirror the
        // IncidentAnalysisDashboard treatment but use SN's
        // `source_closed_at` for closure (requests don't carry
        // `source_resolved_at`).
        let resolvedDay1 = 0;
        const resolvedRows: TicketRow[] = [];
        for (const r of filtered) {
            const closedIso =
                r.source_closed_at ??
                (!isActiveState(r.state) ? (r.source_updated_at ?? r.updated_at) : null);
            if (!closedIso) continue;
            resolvedRows.push(r);
            const opened = Date.parse(openedAt(r));
            const closed = Date.parse(closedIso);
            if (
                Number.isFinite(opened) &&
                Number.isFinite(closed) &&
                closed - opened <= 24 * 60 * 60 * 1000 &&
                closed >= opened
            ) {
                resolvedDay1 += 1;
            }
        }
        const mttrSec = meanOf(resolvedRows, (r) => r.business_resolve_time_sec ?? r.business_duration_sec ?? null);
        const totalTimeWorkedSec = sumOf(resolvedRows, (r) => r.resolve_time_sec ?? r.duration_sec ?? null);

        return {
            total,
            active,
            resolved,
            resolvedRate,
            aging7d,
            aging30d,
            resolvedDay1,
            mttrSec,
            totalTimeWorkedSec,
        };
    }, [filtered, activeRows, now]);

    const stateDonut = useMemo(
        () => groupBy(filtered, (r) => r.state).map((g) => ({ name: g.key, value: g.count })),
        [filtered],
    );

    const groupDonut = useMemo(() => {
        const ranked = groupBy(activeRows, (r) => r.assigned_group).slice(0, 8);
        return ranked.map((g) => ({ name: g.key, value: g.count }));
    }, [activeRows]);

    // Catalog "category" donut — uses SN's `item` (with request_item
    // fallback) since requests don't have a category column. Top-N
    // keeps the donut readable when the long tail is large.
    const categoryDonut = useMemo(() => {
        const ranked = groupBy(activeRows, (r) => r.item ?? r.request_item ?? 'Unknown').slice(0, 8);
        return ranked.map((g) => ({ name: trimLabel(g.key, 32), value: g.count }));
    }, [activeRows]);

    const departmentBar = useMemo(() => {
        const ranked = groupBy(activeRows, departmentOf).slice(0, 10);
        return ranked.map((g) => ({ key: trimLabel(g.key), count: g.count }));
    }, [activeRows]);

    const trendMonths = useMemo(
        () => monthsFromRange(dateRange.from, dateRange.to, now),
        [dateRange.from, dateRange.to, now],
    );
    // Cumulative opened + closed by month. Requests don't have
    // `source_resolved_at` (incidents-only); prefer `source_closed_at`
    // when the upstream sync filled it, then fall back to the row's
    // last-update timestamp when the state already says it's closed
    // (the request dump in dev has source_closed_at empty even on
    // 7800+ "Closed Complete" rows — without this fallback the closed
    // line would flatline at zero).
    const trend = useMemo(
        () =>
            cumulativeTrendByMonth(
                filtered,
                (r) =>
                    r.source_closed_at ??
                    (!isActiveState(r.state) ? (r.source_updated_at ?? r.updated_at) : null),
                trendMonths,
                now,
            ),
        [filtered, trendMonths, now],
    );

    // Non-cumulative monthly opened — separate "Monthly Volume" line
    // chart so users can spot period-over-period swings without the
    // smoothing effect of a cumulative line.
    const monthlyTrend = useMemo(
        () => trendByMonth(filtered, trendMonths, now),
        [filtered, trendMonths, now],
    );

    const onGroupSliceClick = useCallback(
        (slice: { name: string }) => {
            const cur = (filters.assigned_group as string[]) ?? [];
            const next = cur.includes(slice.name)
                ? cur.filter((x) => x !== slice.name)
                : [...cur, slice.name];
            setFilters({ ...filters, assigned_group: next });
        },
        [filters],
    );
    const onGroupLegendToggle = useCallback(
        (name: string) => onGroupSliceClick({ name }),
        [onGroupSliceClick],
    );
    const onStateSliceClick = useCallback(
        (slice: { name: string }) => {
            const cur = (filters.state as string[]) ?? [];
            const next = cur.includes(slice.name)
                ? cur.filter((x) => x !== slice.name)
                : [...cur, slice.name];
            setFilters({ ...filters, state: next });
        },
        [filters],
    );
    const onStateLegendToggle = useCallback(
        (name: string) => onStateSliceClick({ name }),
        [onStateSliceClick],
    );
    const selectedAssignedGroups = (filters.assigned_group as string[]) ?? [];
    const selectedStates = (filters.state as string[]) ?? [];

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';

    const hasFilters = (Object.entries(filters) as [string, unknown][]).some(([, v]) => {
        if (Array.isArray(v)) return v.length > 0;
        const range = v as { from: string | null; to: string | null } | undefined;
        return !!(range?.from || range?.to);
    });

    // Active count of *non-Region/Country* filters — drives the
    // RegionCountryFilter Clear All button visibility (it consolidates
    // every dimension, not just its own).
    const extraActiveFilterCount = useMemo(() => {
        let n = 0;
        const grp = filters.assigned_group;
        if (Array.isArray(grp)) n += grp.length;
        const st = filters.state;
        if (Array.isArray(st)) n += st.length;
        const r = filters.created_at_from as { from: string | null; to: string | null } | undefined;
        if (r && (r.from !== defaultFromIso || r.to !== null)) n += 1;
        return n;
    }, [filters, defaultFromIso]);

    function resetAllParentFilters() {
        setFilters({
            assigned_group: [],
            state: [],
            created_at_from: { from: defaultFromIso, to: null },
            created_at_to: { from: defaultFromIso, to: null },
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
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-sky-100 text-sky-600' : 'bg-sky-500/20 text-sky-400'}`}>
                        <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.catalogTitle')}</h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>{t('pages.catalogSubtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {hasFilters && (
                        <span className="text-xs text-blue-400">
                            {t('pages.filteredCatalog', {
                                filtered: filtered.length.toLocaleString(),
                                total: catalogRows.length.toLocaleString(),
                            })}
                        </span>
                    )}
                    <div className="flex items-center gap-2">
                        <TranslatedAutoRefresh onRefresh={() => void refetch()} storageKey="ops-dashboard:catalog:auto-refresh" />
                        <button
                        onClick={() => void refetch()}
                        className={`p-2 rounded-lg border transition-colors ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
                        title={t('empty.retry')}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    </div>
                </div>
            </div>

            {/* Filter panel — Region/Country in headerSlot, Open Date in
                the slicer grid, consolidated Clear All in headerActions.
                Mirrors the IncidentAnalysis design. */}
            <TopFilterBar
                slicers={slicers}
                value={filters}
                onChange={setFilters}
                storageKey="ops-dashboard:catalog:filters"
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
                        rows={catalogRows}
                        getLocation={locationForFilter}
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

            {/* Scrollable main content */}
            <div className="flex-1 min-h-0 overflow-auto">
                {/* Partial / error banners */}
                {partial && (
                    <div className={`rounded-xl border p-3 mb-3 text-xs flex items-center gap-2 ${isLight ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                        <span>{t('empty.partialResult')}</span>
                        <button onClick={() => void refetch()} className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${isLight ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200'}`}>
                            {t('empty.retry')}
                        </button>
                    </div>
                )}
                {error && !partial && (
                    <div className={`rounded-xl border p-3 mb-3 text-xs flex items-center gap-2 ${isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                        <span>{error}</span>
                        <button onClick={() => void refetch()} className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${isLight ? 'bg-red-100 hover:bg-red-200 text-red-800' : 'bg-red-500/20 hover:bg-red-500/30 text-red-200'}`}>
                            {t('empty.retry')}
                        </button>
                    </div>
                )}

                {/* Row 1: KPIs (top tier — total + outcome metrics) */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                    <KpiCard
                        label={t('kpis.totalCatalogTasks')}
                        value={kpis.total}
                        icon={ShoppingCart}
                        tooltip={t('kpis.totalCatalogTasksInfo')}
                    />
                    <KpiCard
                        label={t('kpis.resolvedDay1')}
                        value={kpis.resolvedDay1}
                        tooltip={t('kpis.resolvedDay1Info')}
                    />
                    <KpiCard
                        label={t('kpis.mttr')}
                        value={formatDurationSec(kpis.mttrSec)}
                        tooltip={t('kpis.mttrInfo')}
                    />
                    <KpiCard
                        label={t('kpis.totalTimeWorked')}
                        value={formatDurationSec(kpis.totalTimeWorkedSec)}
                        tooltip={t('kpis.totalTimeWorkedInfo')}
                    />
                </div>
                {/* Row 1b: KPIs (volume + aging tier) */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                    <KpiCard
                        label={t('kpis.active')}
                        value={kpis.active}
                        tooltip={t('kpis.activeInfo')}
                    />
                    <KpiCard label={t('kpis.resolvedRate')} tooltip={t('kpis.resolvedRateInfo')} value={kpis.resolvedRate} />
                    <KpiCard label={t('kpis.agingGt7d')} tooltip={t('kpis.agingGt7dInfo')} value={kpis.aging7d} />
                    <KpiCard label={t('kpis.agingGt30d')} tooltip={t('kpis.agingGt30dInfo')} value={kpis.aging30d} />
                </div>

                {/* Row 2: Donuts — By Category + By State + By Group */}
                <div className="grid gap-3 mb-3 grid-cols-3">
                    <DonutCard
                        title={t('charts.activeByCategoryCatalog')}
                        info={t('charts.activeByCategoryCatalogInfo')}
                        data={categoryDonut}
                        palette={CATALOG_PALETTE}
                        height={220}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <DonutCard
                        title={t('charts.byStateAll')}
                        info={t('charts.byStateAllInfo')}
                        data={stateDonut}
                        palette={CATALOG_PALETTE}
                        height={220}
                        onSliceClick={onStateSliceClick}
                        selectedSlices={selectedStates}
                        onLegendToggle={onStateLegendToggle}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <DonutCard
                        title={t('charts.activeByGroupCatalog')}
                        subtitle={t('charts.activeByGroupSubtitle')}
                        info={t('charts.activeByGroupCatalogInfo')}
                        data={groupDonut}
                        palette={CATALOG_PALETTE}
                        height={220}
                        onSliceClick={onGroupSliceClick}
                        selectedSlices={selectedAssignedGroups}
                        onLegendToggle={onGroupLegendToggle}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>

                {/* Row 3: Department bar + cumulative trend */}
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '3fr 2fr' }}>
                    <GroupBarCard
                        title={t('charts.byDepartment')}
                        info={t('charts.byDepartmentInfo')}
                        data={departmentBar}
                        topN={10}
                        height={260}
                        color="#0ea5e9"
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <TrendLineCard
                        title={t('charts.volumeTrend')}
                        subtitle={t('charts.cumulativeOpenedClosed')}
                        info={t('charts.volumeTrendInfo')}
                        data={trend}
                        height={260}
                        series={[
                            { key: 'opened', label: 'Opened (cumulative)', color: '#0ea5e9' },
                            { key: 'closed', label: 'Closed (cumulative)', color: '#22c55e' },
                        ]}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>

                {/* Row 4: Non-cumulative monthly opened trend */}
                <div className="mb-3">
                    <TrendLineCard
                        title={t('charts.monthlyVolume')}
                        subtitle={t('charts.monthlyVolumeSubtitle')}
                        info={t('charts.monthlyVolumeInfo')}
                        data={monthlyTrend}
                        height={220}
                        color="#0ea5e9"
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>
            </div>

            {/* Classifier caveat — bottom of page */}
            <ClassifierCaveatFooter />
        </div>
    );
}
