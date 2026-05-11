'use client';

/**
 * Incident Analysis (Page 1.3.4) — ports `temp_ref/.../dashboard/incidents/IncidentDashboardPage.tsx`
 * to the live API via {@link useIncidents}.
 *
 * Base filter: object_type=incident (the `useIncidents` fetcher already
 * pins that server-side). Sidebar slicers narrow by assignment group,
 * priority, department (actor.organization.descriptor), and opened_at
 * range. Active-only KPIs and charts derive from the fetched rows —
 * Phase 1 has no dedicated aggregation endpoints.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Activity, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useIncidents } from '@/lib/hooks/useOpsDashboard';
import type { TicketRow } from '@/lib/api/ops_dashboard';
import {
    ACTIVE_STATES,
    formatDurationSec,
    groupBy,
    isActiveState,
    daysSinceUpdated,
    meanOf,
    monthsFromRange,
    cumulativeTrendByMonth,
    trendByMonth,
    momByDate,
    momActiveSnapshot,
    sumOf,
    formatMoM,
    type DeltaInfo,
} from '@/lib/ops_dashboard/aggregate';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { GroupBarCard } from '@/components/ops_dashboard/GroupBarCard';
import { TrendLineCard } from '@/components/ops_dashboard/TrendLineCard';
import {
    TopFilterBar,
    type FilterState,
    type SlicerConfig,
} from '@/components/ops_dashboard/filters/TopFilterBar';
import { RegionCountryFilter } from '@/components/ops_dashboard/filters/RegionCountryFilter';
import type { Region } from '@/components/ops_dashboard/RegionMap';
import { matchesRegionCountry } from '@/lib/ops_dashboard/region';
import { useOpsGlobalFilter } from '@/lib/hooks/useOpsGlobalFilter';

const STATE_PALETTE = [
    '#3b82f6',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
    '#94a3b8',
];

/**
 * Priority is collapsed from the raw ServiceNow scale (1..5) into
 * three product-friendly buckets: High / Medium / Low. The donut,
 * KPI tiles and the chart-filter all operate on these labels.
 *
 *   1 (Critical) + 2 (High)  → High      — red, urgent
 *   3 (Moderate)             → Medium    — orange
 *   4 (Low) + 5 (Planning)   → Low       — green
 */
type PriorityBucket = 'High' | 'Medium' | 'Low';

const PRIORITY_BUCKET_ORDER: readonly PriorityBucket[] = ['High', 'Medium', 'Low'];

const PRIORITY_BUCKET_COLOR: Record<PriorityBucket, string> = {
    High: '#ef4444',
    Medium: '#f59e0b',
    Low: '#22c55e',
};

/** Pull a leading digit out of a priority label ("P1" / "1" / "1 - Critical" → "1"). */
function priorityDigit(p: string | null | undefined): string | null {
    if (!p) return null;
    const match = p.match(/(\d)/);
    return match ? match[1] : null;
}

/** Map a raw priority value to one of the three product buckets, or null when unrecognised. */
function priorityBucket(p: string | null | undefined): PriorityBucket | null {
    const digit = priorityDigit(p);
    if (!digit) return null;
    if (digit === '1' || digit === '2') return 'High';
    if (digit === '3') return 'Medium';
    if (digit === '4' || digit === '5') return 'Low';
    return null;
}

/**
 * Country / location string used by the RegionCountryFilter. Returns
 * `null` for rows without a resolved location so they don't surface
 * an empty chip in the country list.
 */
function locationOf(row: TicketRow): string | null {
    return row.actor?.location?.descriptor?.trim() || null;
}

function openedDateStr(row: TicketRow): string {
    return (row.created_at ?? '').slice(0, 10);
}

export function IncidentAnalysisDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const deltaLabel = (d: DeltaInfo) =>
        d.trend === 'flat'
            ? t('kpis.momFlat')
            : t('kpis.momDelta', { arrow: d.trend === 'up' ? '▲' : '▼', pct: Math.abs(d.pct) });

    // 3-month default horizon on page load. Seeded into the user-facing
    // filter state so the date picker shows it — otherwise the default is
    // invisible and users mistake it for a data cutoff.
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

    // Capture "now" at mount so aging math is stable across re-renders
    // (react-hooks/purity rejects Date.now() inside useMemo).
    const [now] = useState<number>(() => Date.now());

    const [filters, setFilters] = useState<FilterState>({
        // priority / state are driven exclusively by the donut-legend
        // chart filters now (no slicer in the panel). assigned_group +
        // department are kept in the shape for backward-compat with the
        // FilterState type but never get a UI control.
        assigned_group: [],
        priority: [],
        state: [],
        department: [],
        created_at_from: { from: defaultFromIso, to: null },
        created_at_to: { from: defaultFromIso, to: null },
    });

    // Three-level Region / Country / Location slicer state — geographic.
    // Country is the leading-token form (US, UK, …); Location is the
    // full string (US-California-Palo Alto, …).
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

    // Drive the server fetch from the user-visible date range so the
    // picker and the payload stay in sync. fetchAll: true pages through
    // skip/limit to avoid the 1000-row silent cutoff.
    const dateRange = (filters.created_at_from as { from: string | null; to: string | null } | undefined) ?? { from: null, to: null };
    const { data, loading, error, refetch } = useIncidents(
        {
            limit: 1000,
            created_at_from: dateRange.from ?? undefined,
            created_at_to: dateRange.to ?? undefined,
        },
        { fetchAll: true },
    );

    // Dedicated VIP fetch — `is_vip` is a workers-table column, not a
    // ticket-row field, so the slim view doesn't expose it. We mirror
    // the VipTicketsDashboard approach: ask the backend to filter by
    // is_vip + active states + the same date window, then count the
    // returned rows. Sniffing `r.is_vip` on the slim row would always
    // return undefined → 0, which is what produced the "VIP Active = 0"
    // bug seen on this page.
    const vipQuery = useIncidents(
        {
            limit: 200,
            is_vip: true,
            states_list: ACTIVE_STATES,
            created_at_from: dateRange.from ?? undefined,
            created_at_to: dateRange.to ?? undefined,
        },
        { fetchAll: true },
    );
    const rows: TicketRow[] = useMemo(() => data?.items ?? [], [data]);
    const partial = data?.partial === true;

    // Region/Country live in their own slot at the top of the filter
    // panel (see `headerSlot` on TopFilterBar below). Open Date is the
    // only remaining slicer here; assigned_group / priority / department
    // are intentionally dropped per the new filter contract.
    const slicers: SlicerConfig[] = useMemo(
        () => [
            { type: 'date-range', param: ['created_at_from', 'created_at_to'], label: t('filters.opened') },
        ],
        [t],
    );

    const filtered = useMemo(() => {
        // Priority and state are filter dimensions driven exclusively
        // by the donut-legend chart filters (see togglePriority /
        // toggleState below), not by slicers in the filter panel.
        const prioSel = (filters.priority as string[]) ?? [];
        const stateSel = (filters.state as string[]) ?? [];
        const range = (filters.created_at_from as { from: string | null; to: string | null }) ?? { from: null, to: null };
        return rows.filter((r) => {
            if (!matchesRegionCountry(r, selectedRegions, selectedCountries, selectedLocations, locationOf)) return false;
            if (prioSel.length) {
                const bucket = priorityBucket(r.priority);
                if (!bucket || !prioSel.includes(bucket)) return false;
            }
            if (stateSel.length && !stateSel.includes(r.state)) return false;
            if (range.from || range.to) {
                const opened = openedDateStr(r);
                if (range.from && opened && opened < range.from) return false;
                if (range.to && opened && opened > range.to) return false;
            }
            return true;
        });
    }, [rows, filters, selectedRegions, selectedCountries, selectedLocations]);

    const activeRows = useMemo(() => filtered.filter((r) => isActiveState(r.state)), [filtered]);

    // ── Month-over-month delta ──────────────────────────────────
    // - Total Incidents: count of rows created in the trailing 30
    //   days vs the 30-day window before that ("opened-volume" trend).
    // - Active: snapshot — currently active vs how many were active
    //   30 days ago. Uses created_at + closure timestamps for
    //   point-in-time replay (see momActiveSnapshot).
    // - VIP Active: same snapshot, narrowed to VIP rows.
    const totalMoM = useMemo(
        () => formatMoM(momByDate(filtered, (r) => r.created_at, now)),
        [filtered, now],
    );
    const activeMoM = useMemo(
        () => formatMoM(momActiveSnapshot(filtered, now)),
        [filtered, now],
    );
    // VIP active comes from a dedicated is_vip=true server-side fetch
    // (vipQuery above) — no MoM delta available because that fetch
    // only returns currently-active rows.

    const kpis = useMemo(() => {
        const total = filtered.length;
        const active = activeRows.length;
        let aging2d = 0;
        let aging7d = 0;
        for (const r of activeRows) {
            const days = daysSinceUpdated(r, now);
            if (days > 2) aging2d += 1;
            if (days > 7) aging7d += 1;
        }

        // Resolved-on-day-1: incidents with both an open and resolve
        // timestamp where resolve happened within 24h of opening.
        // Falls back to created_at when source_opened_at is null.
        let resolvedDay1 = 0;
        const resolvedRows: TicketRow[] = [];
        for (const r of filtered) {
            if (!r.source_resolved_at) continue;
            resolvedRows.push(r);
            const opened = Date.parse(r.source_opened_at ?? r.created_at);
            const resolved = Date.parse(r.source_resolved_at);
            if (
                Number.isFinite(opened) &&
                Number.isFinite(resolved) &&
                resolved - opened <= 24 * 60 * 60 * 1000 &&
                resolved >= opened
            ) {
                resolvedDay1 += 1;
            }
        }

        // Mean Time to Resolve — business-hours calendar so nights /
        // weekends don't inflate the average. Prefers SN's
        // ``business_duration_sec`` (total business-hours from create
        // → close) and falls back to ``business_resolve_time_sec``
        // (business-hours from create → first resolve). The dev dump
        // omits business_duration; production carries both.
        const mttrSec = meanOf(
            resolvedRows,
            (r) => r.business_duration_sec ?? r.business_resolve_time_sec ?? null,
        );

        // Total Time Worked — sum of resolve_time_sec across every
        // resolved row in scope. resolve_time_sec is total wall-clock
        // resolve time (vs. business_resolve_time_sec which is
        // business-hours-only). Falls back to duration_sec when the
        // SN sync didn't populate resolve_time.
        const totalTimeWorkedSec = sumOf(
            resolvedRows,
            (r) => r.resolve_time_sec ?? r.duration_sec ?? null,
        );

        // VIP active comes from the dedicated is_vip=true server-side
        // fetch — see comment on `vipQuery` above. Apply the same
        // Region/Country slicer so the KPI tracks geo narrowing.
        const vipRows = vipQuery.data?.items ?? [];
        const vipActive = vipRows.filter((r) =>
            matchesRegionCountry(
                r,
                selectedRegions,
                selectedCountries,
                selectedLocations,
                locationOf,
            ),
        ).length;
        const resolvedRate = total > 0 ? `${(((total - active) / total) * 100).toFixed(1)}%` : '—';
        return {
            total,
            active,
            resolvedDay1,
            mttrSec,
            totalTimeWorkedSec,
            aging2d,
            aging7d,
            vipActive,
            resolvedRate,
        };
    }, [
        filtered,
        activeRows,
        now,
        vipQuery.data,
        selectedRegions,
        selectedCountries,
        selectedLocations,
    ]);

    const priorityDonut = useMemo(() => {
        // Bucket the active rows into High/Medium/Low and emit slices
        // in canonical order (High first) so colours stay stable
        // regardless of which buckets happen to have rows this period.
        const counts: Record<PriorityBucket, number> = { High: 0, Medium: 0, Low: 0 };
        for (const r of activeRows) {
            const bucket = priorityBucket(r.priority);
            if (bucket) counts[bucket] += 1;
        }
        return PRIORITY_BUCKET_ORDER.map((bucket) => ({
            name: bucket,
            value: counts[bucket],
            color: PRIORITY_BUCKET_COLOR[bucket],
        }));
    }, [activeRows]);

    // Category donut — replaces the By Priority slice on the page.
    // Uses SN's incident.category column; rows missing a category fall
    // into a "Unknown" bucket so the donut total still matches the
    // active-row count.
    const categoryDonut = useMemo(
        () =>
            groupBy(activeRows, (r) => r.category ?? 'Unknown')
                .slice(0, 8)
                .map((g) => ({ name: g.key, value: g.count })),
        [activeRows],
    );

    const stateDonut = useMemo(
        () => groupBy(filtered, (r) => r.state).map((g) => ({ name: g.key, value: g.count })),
        [filtered],
    );

    const groupBar = useMemo(() => groupBy(activeRows, (r) => r.assigned_group), [activeRows]);

    const trendMonths = useMemo(
        () => monthsFromRange(dateRange.from, dateRange.to, now),
        [dateRange.from, dateRange.to, now],
    );
    // Cumulative opened + closed by month. Closure timestamp prefers
    // SN's resolved_at (incidents are "closed" once resolved per the
    // ServiceNow lifecycle), then source_closed_at, then a state-based
    // fallback to the row's last-update timestamp — the fallback only
    // matters for the handful of rows where SN didn't sync a timestamp
    // even though the state says closed.
    const trend = useMemo(
        () =>
            cumulativeTrendByMonth(
                filtered,
                (r) =>
                    r.source_resolved_at ??
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

    // Both the donut slice click (via DonutCard.onSliceClick) and the
    // interactive legend toggle (via DonutCard.onLegendToggle) feed
    // through these toggle helpers so the two stay in sync.
    const togglePriority = (name: string) => {
        const cur = (filters.priority as string[]) ?? [];
        const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
        setFilters({ ...filters, priority: next });
    };
    const onPrioritySliceClick = (slice: { name: string }) => togglePriority(slice.name);
    const selectedPriorities = (filters.priority as string[]) ?? [];

    const toggleState = (name: string) => {
        const cur = (filters.state as string[]) ?? [];
        const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
        setFilters({ ...filters, state: next });
    };
    const onStateSliceClick = (slice: { name: string }) => toggleState(slice.name);
    const selectedStates = (filters.state as string[]) ?? [];

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';

    const hasFilters = (Object.entries(filters) as [string, unknown][]).some(([, v]) => {
        if (Array.isArray(v)) return v.length > 0;
        const range = v as { from: string | null; to: string | null } | undefined;
        return !!(range?.from || range?.to);
    });

    /**
     * Number of *non* Region/Country filters active right now — used
     * to drive the consolidated Clear All button. Counts:
     *   - Priority (Active by Priority donut)
     *   - State (By State donut)
     *   - Open Date range (when not at the page default)
     */
    const extraActiveFilterCount = useMemo(() => {
        let n = 0;
        const prio = filters.priority;
        if (Array.isArray(prio)) n += prio.length;
        const st = filters.state;
        if (Array.isArray(st)) n += st.length;
        const r = filters.created_at_from as { from: string | null; to: string | null } | undefined;
        // Default state has from=defaultFromIso, to=null. Anything other
        // than that should count as "active" so the clear button lights
        // up. Cheapest check: any deviation from the default.
        if (r && (r.from !== defaultFromIso || r.to !== null)) n += 1;
        return n;
    }, [filters, defaultFromIso]);

    /**
     * Reset every parent-owned filter back to its initial state.
     * Keeps the date range at the 3-month default to match the page's
     * load-time contract (the picker would otherwise look "blank").
     */
    function resetAllParentFilters() {
        setFilters({
            assigned_group: [],
            priority: [],
            state: [],
            department: [],
            created_at_from: { from: defaultFromIso, to: null },
            created_at_to: { from: defaultFromIso, to: null },
        });
    }

    // Total active filter count across every dimension — the panel-level
    // Clear All button uses this to flip between the red (clickable)
    // and grey (disabled) states defined by the original filter spec.
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
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400'}`}>
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.incidentsTitle')}</h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>{t('pages.incidentsSubtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {hasFilters && (
                        <span className="text-xs text-blue-400">
                            {t('pages.filteredIncidents', {
                                filtered: filtered.length.toLocaleString(),
                                total: rows.length.toLocaleString(),
                            })}
                        </span>
                    )}
                    <button
                        onClick={() => void refetch()}
                        className={`p-2 rounded-lg border transition-colors ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
                        title={t('empty.retry')}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Filter panel — Region/Country in the headerSlot, Open Date
                in the slicer grid, and a single consolidated "Clear All
                Filters" button pinned to the panel's top-right via
                headerActions. Priority + state are donut-driven now. */}
            <TopFilterBar
                slicers={slicers}
                value={filters}
                onChange={setFilters}
                storageKey="ops-dashboard:incidents:filters"
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
                        rows={rows}
                        getLocation={locationOf}
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

                {/* KPI row */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                    <KpiCard
                        label={t('kpis.totalIncidents')}
                        value={kpis.total}
                        icon={AlertTriangle}
                        tooltip={t('kpis.totalIncidentsInfo')}
                    />
                    <KpiCard
                        label={t('kpis.resolvedDay1')}
                        value={kpis.resolvedDay1}
                        icon={Activity}
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
                <div className="grid grid-cols-4 gap-3 mb-3">
                    <KpiCard label={t('kpis.agingGt2d')} tooltip={t('kpis.agingGt2dInfo')} value={kpis.aging2d} />
                    <KpiCard label={t('kpis.agingGt7d')} tooltip={t('kpis.agingGt7dInfo')} value={kpis.aging7d} />
                    <KpiCard
                        label={t('kpis.vipActive')}
                        value={kpis.vipActive}
                        icon={Star}
                        tooltip={t('kpis.vipActiveInfo')}
                    />
                    <KpiCard label={t('kpis.resolvedRate')} tooltip={t('kpis.resolvedRateInfo')} value={kpis.resolvedRate} />
                </div>

                {/* Donut row */}
                <div className="grid gap-3 mb-3 grid-cols-2">
                    <DonutCard
                        title={t('charts.activeByCategoryIncidents')}
                        info={t('charts.activeByCategoryIncidentsInfo')}
                        data={categoryDonut}
                        height={220}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <DonutCard
                        title={t('charts.byStateAll')}
                        info={t('charts.byStateAllInfo')}
                        data={stateDonut}
                        palette={STATE_PALETTE}
                        height={220}
                        // Same interactive contract as the priority donut:
                        // slice click + legend toggle both feed through
                        // the shared toggleState helper.
                        onSliceClick={onStateSliceClick}
                        selectedSlices={selectedStates}
                        onLegendToggle={toggleState}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>

                {/* Bar + trend row */}
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '3fr 2fr' }}>
                    <GroupBarCard
                        title={t('charts.activeByGroup')}
                        info={t('charts.activeByGroupInfo')}
                        data={groupBar}
                        topN={10}
                        height={260}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <TrendLineCard
                        title={t('charts.monthlyOpenedTrend', { months: trendMonths })}
                        subtitle={t('charts.cumulativeOpenedClosed')}
                        info={t('charts.monthlyOpenedTrendInfo', { months: trendMonths })}
                        data={trend}
                        height={260}
                        series={[
                            { key: 'opened', label: 'Opened (cumulative)', color: '#ef4444' },
                            { key: 'closed', label: 'Closed (cumulative)', color: '#22c55e' },
                        ]}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>

                {/* Row: Non-cumulative monthly opened trend */}
                <div className="mb-3">
                    <TrendLineCard
                        title={t('charts.monthlyVolume')}
                        subtitle={t('charts.monthlyVolumeSubtitle')}
                        info={t('charts.monthlyVolumeInfo')}
                        data={monthlyTrend}
                        height={220}
                        color="#ef4444"
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>
            </div>
        </div>
    );
}
