'use client';

/**
 * Active Monitoring Hub (Page 1.3.10) — active-ticket monitoring page.
 *
 * Data sources (two concurrent fetches):
 *   - useIncidents({ limit: 1000 })
 *   - useRequests({ limit: 1000 })
 *
 * Incidents + requests are merged into one "tickets" array for
 * aggregation. The page exposes ticket sidebar filter groups plus
 * chart cross-filters — clicking an assignment-group donut slice
 * toggles that group in the sidebar. TicketsPanel handles all the
 * KPI and chart rendering.
 */

import { useMemo, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useIncidents, useRequests } from '@/lib/hooks/useOpsDashboard';
import type { TicketRow } from '@/lib/api/ops_dashboard';
import {
    ACTIVE_STATES,
    classifyRequestType,
    daysSinceUpdated,
    formatMoM,
    groupBy,
    isActiveState,
    momActiveSnapshot,
    monthsFromRange,
    trendByMonth,
} from '@/lib/ops_dashboard/aggregate';
import { type Region, type RegionBubble } from '@/components/ops_dashboard/RegionMap';
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
import { TicketsPanel, type TicketKpiDeltas, type TicketKpis } from './TicketsPanel';

function locationOf(row: TicketRow): string {
    return row.actor?.location?.descriptor?.trim() || 'Unknown';
}

function locationForFilter(row: TicketRow): string | null {
    return row.actor?.location?.descriptor?.trim() || null;
}

function regionOf(row: TicketRow): Region {
    // 1. Trust the backend-resolved region when it normalises cleanly.
    //    Backend stores values like "Americas" / "APAC" / "EMEA" / "Unknown"
    //    — `normalizeRegion` handles every variant we've seen.
    const fromActor = normalizeRegion(row.actor?.location?.region);
    if (fromActor) return fromActor;

    // 2. Try to resolve a region from the location descriptor
    //    (e.g. "US-California-Palo Alto" → AMER) using the curated
    //    country→region map shared with RegionCountryFilter.
    const fromLocation = countryToRegion(row.actor?.location?.descriptor);
    if (fromLocation) return fromLocation;

    // 3. Last resort: sniff the assigned_group prefix
    //    ("AMER OIT Support" / "EMEA HelpDesk" / "Asia Service").
    const fromGroup = normalizeRegion(row.assigned_group);
    if (fromGroup) return fromGroup;

    return 'OTHER';
}

export function OpsDashboardHub() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // ── Filter state ────────────────────────────────────────────
    // assigned_group / priority / location are all donut-driven now.
    //
    // Active Monitoring Hub is the "right now" view of every open
    // ticket — applying the month-to-date Open-date filter would
    // truncate older active tickets that were opened in prior months
    // but are still unresolved (the page would suddenly drop ~80% of
    // its volume the moment the calendar rolled over). Drill-in
    // dashboards (Catalog / Incidents / OnOffBoarding) keep the MTD
    // default since they're analytical / volume-trend oriented.
    const [ticketFilters, setTicketFilters] = useState<FilterState>({
        assigned_group: [],
        location: [],
        priority: [],
    });

    // Two-level Region/Country slicer state — geographic. Region AND
    // Country apply to tickets. Region / Country / Location are
    // SHARED across every MONITORING dashboard via useOpsGlobalFilter
    // — picking AMER on one page carries the selection to the others
    // so users don't repeat it.
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

    // ── Two concurrent fetches ─────────────────────────────────
    // fetchAll: true pages through skip/limit so we don't hit the 1000-row
    // silent cutoff. created_at_from/to are read off ticketFilters so the
    // picker and the payload stay in sync.
    const incidentQuery = useIncidents(
        {
            limit: 1000,
            view: 'slim',
            created_at_from: ticketDateRange.from ?? undefined,
            created_at_to: ticketDateRange.to ?? undefined,
        },
        { fetchAll: true },
    );
    const requestQuery = useRequests(
        {
            limit: 1000,
            view: 'slim',
            created_at_from: ticketDateRange.from ?? undefined,
            created_at_to: ticketDateRange.to ?? undefined,
        },
        { fetchAll: true },
    );

    // Dedicated VIP fetches — `is_vip` is a workers-table column, not a
    // ticket-row field, so the slim view doesn't expose it. Mirroring
    // the VipTicketsDashboard approach: ask the backend to filter by
    // is_vip + active states + the same date window, then count the
    // returned rows. Lightweight (single-digit volume in dev) and
    // keeps the Hub's VIP KPI consistent with the dedicated VIP page.
    const vipIncidentQuery = useIncidents(
        {
            limit: 200,
            view: 'slim',
            is_vip: true,
            states_list: ACTIVE_STATES,
            created_at_from: ticketDateRange.from ?? undefined,
            created_at_to: ticketDateRange.to ?? undefined,
        },
        { fetchAll: true },
    );
    const vipRequestQuery = useRequests(
        {
            limit: 200,
            view: 'slim',
            is_vip: true,
            states_list: ACTIVE_STATES,
            created_at_from: ticketDateRange.from ?? undefined,
            created_at_to: ticketDateRange.to ?? undefined,
        },
        { fetchAll: true },
    );

    const loading =
        incidentQuery.loading ||
        requestQuery.loading ||
        vipIncidentQuery.loading ||
        vipRequestQuery.loading;
    const partial =
        incidentQuery.data?.partial === true ||
        requestQuery.data?.partial === true ||
        vipIncidentQuery.data?.partial === true ||
        vipRequestQuery.data?.partial === true;
    const error =
        incidentQuery.error ??
        requestQuery.error ??
        vipIncidentQuery.error ??
        vipRequestQuery.error;
    const refetchAll = async () => {
        await Promise.all([
            incidentQuery.refetch(),
            requestQuery.refetch(),
            vipIncidentQuery.refetch(),
            vipRequestQuery.refetch(),
        ]);
    };

    // Stable clock so aging math doesn't flip during re-renders.
    const [now] = useState<number>(() => Date.now());

    const allTickets: TicketRow[] = useMemo(() => {
        const a = incidentQuery.data?.items ?? [];
        const b = requestQuery.data?.items ?? [];
        return [...a, ...b];
    }, [incidentQuery.data, requestQuery.data]);

    // Ticket rows fed to RegionCountryFilter so Country + Location
    // dropdowns surface every place that exists in the ticket data.
    // Each entry exposes a single `location` field — the filter's
    // `getLocation` extractor reads it directly.
    const regionCountryRows = useMemo(() => {
        return allTickets.map((t) => ({ location: locationForFilter(t) }));
    }, [allTickets]);

    // ── Filtered tickets (Region/Country + donut filters) ─
    const filteredTickets = useMemo(() => {
        const groupSel = (ticketFilters.assigned_group as string[]) ?? [];
        const locSel = (ticketFilters.location as string[]) ?? [];
        const prioSel = (ticketFilters.priority as string[]) ?? [];
        return allTickets.filter((r) => {
            if (!matchesRegionCountry(r, selectedRegions, selectedCountries, selectedLocations, locationForFilter)) return false;
            if (groupSel.length && !groupSel.includes(r.assigned_group ?? 'Unknown')) return false;
            if (locSel.length && !locSel.includes(locationOf(r))) return false;
            if (prioSel.length && !prioSel.includes(r.priority)) return false;
            return true;
        });
    }, [allTickets, ticketFilters, selectedRegions, selectedCountries, selectedLocations]);

    const activeTickets = useMemo(
        () => filteredTickets.filter((r) => isActiveState(r.state)),
        [filteredTickets],
    );

    // ── Ticket KPIs ─────────────────────────────────────────────
    const ticketKpis: TicketKpis = useMemo(() => {
        let activeIncident = 0;
        let activeIncidentHigh = 0;
        let activeCatalog = 0;
        let activeAsset = 0;
        let unassigned = 0;
        let agingIncidentGt2d = 0;
        let agingCatalogGt30d = 0;
        let agingAssetGt30d = 0;
        for (const r of activeTickets) {
            if (r.object_type === 'incident') {
                activeIncident += 1;
                if (r.priority === 'High') activeIncidentHigh += 1;
            } else if (r.object_type === 'request') {
                const rt = classifyRequestType(r);
                if (rt === 'asset_task') activeAsset += 1;
                else if (rt === 'catalog_task') activeCatalog += 1;
            }
            // Use `assigned_to_oid` (sys_id) as the source of truth for
            // unassigned. The upstream sync drops `assigned_to_name` for
            // many rows whose sys_id is populated, so filtering on the
            // name field over-counts unassigned by ~5x. See
            // UnassignedTicketsDashboard.tsx for the longer note.
            if (!r.assigned_to_oid || (typeof r.assigned_to_oid === 'string' && r.assigned_to_oid.trim() === '')) unassigned += 1;
            const days = daysSinceUpdated(r, now);
            if (r.object_type === 'incident' && days > 2) agingIncidentGt2d += 1;
            if (r.object_type === 'request' && days > 30) {
                const rt = classifyRequestType(r);
                if (rt === 'asset_task') agingAssetGt30d += 1;
                else if (rt === 'catalog_task') agingCatalogGt30d += 1;
            }
        }
        // VIP count comes from a dedicated `is_vip=true` server-side
        // query — `is_vip` is a workers-table column, not a ticket-row
        // field, so we can't sniff it on the slim view rows. The same
        // Region/Country slicer applies to the VIP rows so the KPI
        // tracks any geographic narrowing the user sets.
        const vipRows = [
            ...(vipIncidentQuery.data?.items ?? []),
            ...(vipRequestQuery.data?.items ?? []),
        ];
        const vipActive = vipRows.filter((r) =>
            matchesRegionCountry(
                r,
                selectedRegions,
                selectedCountries,
                selectedLocations,
                locationForFilter,
            ),
        ).length;
        return {
            totalActive: activeTickets.length,
            activeIncident,
            activeIncidentHigh,
            activeCatalog,
            activeAsset,
            vipActive,
            unassigned,
            agingIncidentGt2d,
            agingCatalogGt30d,
            agingAssetGt30d,
        };
    }, [
        activeTickets,
        now,
        vipIncidentQuery.data,
        vipRequestQuery.data,
        selectedRegions,
        selectedCountries,
        selectedLocations,
    ]);

    // Month-over-month deltas — snapshot replays based on created_at +
    // closure timestamps. Skipped for the four aging KPIs since their
    // "snapshot at past time" depends on `source_updated_at`, which is
    // a moving target (no per-row history available).
    const ticketKpiDeltas: TicketKpiDeltas = useMemo(() => {
        const isCatalog = (r: TicketRow) =>
            r.object_type === 'request' && classifyRequestType(r) === 'catalog_task';
        const isAssetTask = (r: TicketRow) =>
            r.object_type === 'request' && classifyRequestType(r) === 'asset_task';
        // VIP MoM delta is intentionally null — vipIncidentQuery /
        // vipRequestQuery only fetch *currently-active* VIP rows
        // (states_list=ACTIVE_STATES filter on the server), so we
        // don't have the historical resolution events needed to
        // compute "VIP active a month ago". Surfacing a number here
        // would either require a second un-filtered VIP fetch or a
        // backend `is_vip` field on the ticket row. Defer either to
        // Phase 2 — for now the tile shows the live VIP count with
        // no MoM annotation.
        return {
            totalActive: formatMoM(momActiveSnapshot(filteredTickets, now)),
            activeIncident: formatMoM(
                momActiveSnapshot(filteredTickets, now, (r) => r.object_type === 'incident'),
            ),
            activeCatalog: formatMoM(momActiveSnapshot(filteredTickets, now, isCatalog)),
            activeAsset: formatMoM(momActiveSnapshot(filteredTickets, now, isAssetTask)),
            vipActive: null,
        };
    }, [filteredTickets, now]);

    // ── Chart data ──────────────────────────────────────────────
    const groupDonut = useMemo(
        () =>
            groupBy(activeTickets, (r) => r.assigned_group)
                .slice(0, 8)
                .map((g) => ({ name: g.key, value: g.count })),
        [activeTickets],
    );

    // By-Assignee bar — top 10 by active ticket count. Bar chart over
    // donut because assignee names are long (user IDs / full names)
    // and a donut with > 8 slices becomes unreadable at chart size.
    // Unassigned rows fall into the "Unassigned" bucket so the chart
    // surfaces the backlog-without-an-owner signal.
    const assigneeBar = useMemo(
        () =>
            groupBy(activeTickets, (r) => r.assigned_to_name?.trim() || 'Unassigned')
                .slice(0, 10),
        [activeTickets],
    );

    const trendMonths = useMemo(
        () => monthsFromRange(ticketDateRange.from, ticketDateRange.to, now),
        [ticketDateRange.from, ticketDateRange.to, now],
    );
    const trend = useMemo(
        () => trendByMonth(filteredTickets, trendMonths, now),
        [filteredTickets, trendMonths, now],
    );

    const regionData: RegionBubble[] = useMemo(() => {
        const counts: Record<Region, number> = { AMER: 0, EMEA: 0, APAC: 0, OTHER: 0 };
        for (const r of activeTickets) counts[regionOf(r)] += 1;
        return (Object.keys(counts) as Region[]).map((region) => ({ region, count: counts[region] }));
    }, [activeTickets]);

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

    const allTicketsActive = useMemo(
        () => allTickets.filter((r) => isActiveState(r.state)).length,
        [allTickets],
    );

    // ── Consolidated Clear All: covers every dimension across tickets +
    //   assets, including the donut-driven chart filters and Region/Country.
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
                <button
                    onClick={() => void refetchAll()}
                    className={`p-2 rounded-lg border transition-colors ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
                    title={t('empty.retry')}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Filter panel — Region/Country in headerSlot applies to
                tickets (full geographic match). Open Date applies to
                tickets. Everything else is donut-driven (chart filters).
                Single Clear All button at the top-right. */}
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
                        // Union of tickets + assets so the Country and
                        // Location dropdowns surface every place that
                        // exists in either data set. Each unified row
                        // carries a single `location` field — exactly
                        // what `getLocation` reads.
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

            {/* Scrollable main content */}
            <div className="flex-1 min-h-0 overflow-auto">
                {/* Partial / error banners */}
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
                    trend={trend}
                    trendMonths={trendMonths}
                    regionData={regionData}
                    loading={loading}
                    filteredCount={activeTickets.length}
                    totalActiveCount={allTicketsActive}
                    onGroupSliceClick={onGroupSliceClick}
                    selectedGroups={selectedAssignedGroups}
                    onGroupLegendToggle={onGroupLegendToggle}
                />
            </div>
        </div>
    );
}
