'use client';

/**
 * Active Monitoring Hub (Page 1.3.10) — combines active-ticket
 * monitoring with the hardware-fleet overview in a single page.
 *
 * Data sources (three concurrent fetches):
 *   - useIncidents({ limit: 1000 })
 *   - useRequests({ limit: 1000 })
 *   - useHardwares({ is_active, limit: 1000 })
 *
 * Incidents + requests are merged into one "tickets" array for
 * aggregation; hardwares are narrowed client-side to
 * DASHBOARD_ASSET_CATEGORIES. The page exposes two sidebar filter
 * groups (tickets + assets) plus chart cross-filters — clicking an
 * assignment-group donut slice toggles that group in the ticket
 * sidebar. Ticket / asset panel markup is factored into
 * TicketsPanel / AssetsPanel to keep this file focused on data
 * wiring.
 */

import { useMemo, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useHardwares, useIncidents, useRequests } from '@/lib/hooks/useOpsDashboard';
import type { HardwareRow, TicketRow } from '@/lib/api/ops_dashboard';
import {
    classifyRequestType,
    daysSinceUpdated,
    formatMoM,
    groupBy,
    inferDeviceType,
    isActiveState,
    isInStock,
    momActiveSnapshot,
    monthsFromRange,
    summarizeAssets,
    trendByMonth,
} from '@/lib/ops_dashboard/aggregate';
import { type Region, type RegionBubble } from '@/components/ops_dashboard/RegionMap';
import {
    TopFilterBar,
    type FilterState,
    type SlicerConfig,
} from '@/components/ops_dashboard/filters/TopFilterBar';
import { RegionCountryFilter } from '@/components/ops_dashboard/filters/RegionCountryFilter';
import {
    countryToRegion,
    extractCountry,
    matchesRegionCountry,
    normalizeRegion,
} from '@/lib/ops_dashboard/region';
import { TicketsPanel, type TicketKpiDeltas, type TicketKpis } from './TicketsPanel';
import { AssetsPanel, type SupportGroupMatrixRow } from './AssetsPanel';

const DASHBOARD_ASSET_CATEGORIES = new Set(['Computer', 'Desktop', 'Hardware', 'Server', 'Laptop']);

function locationOf(row: TicketRow): string {
    return row.actor?.location?.descriptor?.trim() || 'Unknown';
}

/** Country/location string used by RegionCountryFilter — null when unresolved. */
function locationForFilter(row: TicketRow): string | null {
    return row.actor?.location?.descriptor?.trim() || null;
}

/**
 * Asset-side equivalent of locationForFilter. The hardware row's
 * `location` column is populated for ~99.9% of assets in the same
 * "Country-City-…" format the tickets use, so RegionCountryFilter +
 * countryToRegion light up automatically.
 */
function assetLocationForFilter(row: HardwareRow): string | null {
    return row.location?.trim() || null;
}

function regionOf(row: TicketRow): Region {
    const raw = (row.actor?.location?.region ?? '').trim().toUpperCase();
    if (raw === 'AMER' || raw === 'EMEA' || raw === 'APAC') return raw;
    // Fallback: sniff the assigned_group (e.g. "AMER OIT Support").
    const grp = (row.assigned_group ?? '').toUpperCase();
    if (grp.startsWith('AMER')) return 'AMER';
    if (grp.startsWith('EMEA')) return 'EMEA';
    if (grp.startsWith('APAC')) return 'APAC';
    return 'OTHER';
}

function procuredByOf(row: HardwareRow): string {
    // `asset_owner` carries the procurement-side ownership label
    // (typically "OIT" or "Studio"). The earlier implementation used
    // `company`, which is the legal entity that bought the device —
    // not the same concept.
    return row.asset_owner?.trim() || 'Unknown';
}

function supportGroupOf(row: HardwareRow): string {
    // Hardware doesn't have a dedicated `support_group` column. Mirror
    // the ticket assignment-group convention by deriving it from
    // whichever region-shaped field on the row resolves first:
    //   1. office_region  ("AMER" / "APAC" / "EMEA" — canonical)
    //   2. region          (lowercase "amer" / "apac" / "eurp")
    //   3. region_code     ("APAC 2" / "AMER-1" — leading token)
    //   4. location as a region label  ("Europe", "APAC")
    //   5. location-derived country  ("US-California-…" → AMER)
    //   6. stock_room-derived country  ("Singapore TWP Office" → APAC)
    // Only assets with no resolvable region anywhere land in
    // "Unassigned".
    const r =
        normalizeRegion(row.office_region) ??
        normalizeRegion(row.region) ??
        normalizeRegion(row.region_code) ??
        normalizeRegion(row.location) ??
        countryToRegion(extractCountry(row.location)) ??
        countryToRegion(row.stock_room);
    return r ? `${r} OIT Support` : 'Unassigned';
}

export function OpsDashboardHub() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // Default the opened-date window to the last 3 months. Seeded into
    // the user-visible filter state so the date picker reflects it —
    // otherwise the default is invisible and users mistake it for a
    // server-side cutoff.
    const [defaultFromIso] = useState<string>(
        () => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    );

    // ── Filter state ────────────────────────────────────────────
    // Declared before the API fetches so the ticket query can read the
    // current date range off ticketFilters.
    //
    // Mirrors the IncidentAnalysis design: assigned_group / priority /
    // location (tickets) and support_group / procured_by / department
    // (assets) are all donut-driven now — they keep their FilterState
    // keys but no longer get panel slicers. Region/Country live in
    // their own slot.
    const [ticketFilters, setTicketFilters] = useState<FilterState>({
        assigned_group: [],
        location: [],
        priority: [],
        created_at_from: { from: defaultFromIso, to: null },
        created_at_to: { from: defaultFromIso, to: null },
    });
    const [assetFilters, setAssetFilters] = useState<FilterState>({
        support_group: [],
        procured_by: [],
        department: [],
        // Chart-only — driven by the In-Stock Location donut.
        stock_room: [],
    });

    // Two-level Region/Country slicer state — geographic. Region AND
    // Country both apply to tickets *and* assets: the asset's
    // `location` column carries the same "Country-City-…" vocabulary as
    // the ticket's caller location (~99.9% fill rate), so the filter
    // narrows both data sets in lockstep.
    const [selectedRegions, setSelectedRegions] = useState<Region[]>([]);
    const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<string[]>([]);

    const ticketDateRange =
        (ticketFilters.created_at_from as { from: string | null; to: string | null } | undefined) ??
        { from: null, to: null };

    // ── Three concurrent fetches ─────────────────────────────────
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
    const hardwareQuery = useHardwares(
        { limit: 1000, is_active: true, view: 'slim' },
        { fetchAll: true },
    );

    const loading = incidentQuery.loading || requestQuery.loading || hardwareQuery.loading;
    const partial =
        incidentQuery.data?.partial === true ||
        requestQuery.data?.partial === true ||
        hardwareQuery.data?.partial === true;
    const error = incidentQuery.error ?? requestQuery.error ?? hardwareQuery.error;
    const refetchAll = async () => {
        await Promise.all([incidentQuery.refetch(), requestQuery.refetch(), hardwareQuery.refetch()]);
    };

    // Stable clock so aging math doesn't flip during re-renders.
    const [now] = useState<number>(() => Date.now());

    const allTickets: TicketRow[] = useMemo(() => {
        const a = incidentQuery.data?.items ?? [];
        const b = requestQuery.data?.items ?? [];
        return [...a, ...b];
    }, [incidentQuery.data, requestQuery.data]);

    const allAssets: HardwareRow[] = useMemo(() => {
        const rows = hardwareQuery.data?.items ?? [];
        return rows.filter((r) => r.model_category && DASHBOARD_ASSET_CATEGORIES.has(r.model_category));
    }, [hardwareQuery.data]);

    // Combined ticket+asset rows fed to RegionCountryFilter so the
    // Country + Location dropdowns surface every place that exists in
    // either data set. Each entry exposes a single `location` field —
    // the filter's `getLocation` extractor reads it directly.
    const regionCountryRows = useMemo(() => {
        const out: Array<{ location: string | null }> = [];
        for (const t of allTickets) out.push({ location: locationForFilter(t) });
        for (const a of allAssets) out.push({ location: assetLocationForFilter(a) });
        return out;
    }, [allTickets, allAssets]);

    // Open Date is the only panel slicer; everything else is donut-driven
    // or lives in the Region/Country headerSlot.
    const ticketSlicers: SlicerConfig[] = useMemo(
        () => [
            { type: 'date-range', param: ['created_at_from', 'created_at_to'], label: t('filters.opened') },
        ],
        [t],
    );

    // ── Filtered tickets (Region/Country + donut filters + date) ─
    const filteredTickets = useMemo(() => {
        const groupSel = (ticketFilters.assigned_group as string[]) ?? [];
        const locSel = (ticketFilters.location as string[]) ?? [];
        const prioSel = (ticketFilters.priority as string[]) ?? [];
        const range =
            (ticketFilters.created_at_from as { from: string | null; to: string | null }) ??
            { from: null, to: null };
        return allTickets.filter((r) => {
            if (!matchesRegionCountry(r, selectedRegions, selectedCountries, selectedLocations, locationForFilter)) return false;
            if (groupSel.length && !groupSel.includes(r.assigned_group ?? 'Unknown')) return false;
            if (locSel.length && !locSel.includes(locationOf(r))) return false;
            if (prioSel.length && !prioSel.includes(r.priority)) return false;
            if (range.from || range.to) {
                const opened = (r.created_at ?? '').slice(0, 10);
                if (range.from && opened && opened < range.from) return false;
                if (range.to && opened && opened > range.to) return false;
            }
            return true;
        });
    }, [allTickets, ticketFilters, selectedRegions, selectedCountries, selectedLocations]);

    const activeTickets = useMemo(
        () => filteredTickets.filter((r) => isActiveState(r.state)),
        [filteredTickets],
    );

    // ── Filtered assets ─────────────────────────────────────────
    // Region + Country + Location apply via the asset's `location`
    // column. The donut-driven chart filters are independent of those
    // and live on `assetFilters` (procured_by / support_group /
    // stock_room). stock_room is what the In-Stock Location donut
    // toggles now (was "region"; the stockroom name reads cleaner).
    const filteredAssets = useMemo(() => {
        const supportGroupSel = (assetFilters.support_group as string[]) ?? [];
        const procuredSel = (assetFilters.procured_by as string[]) ?? [];
        const deptSel = (assetFilters.department as string[]) ?? [];
        const stockRoomSel = (assetFilters.stock_room as string[]) ?? [];
        return allAssets.filter((r) => {
            if (!matchesRegionCountry(r, selectedRegions, selectedCountries, selectedLocations, assetLocationForFilter)) return false;
            if (supportGroupSel.length && !supportGroupSel.includes(supportGroupOf(r))) return false;
            if (procuredSel.length && !procuredSel.includes(procuredByOf(r))) return false;
            if (deptSel.length && !deptSel.includes(r.department ?? 'Unknown')) return false;
            if (stockRoomSel.length && !stockRoomSel.includes(r.stock_room ?? 'Unknown')) return false;
            return true;
        });
    }, [allAssets, assetFilters, selectedRegions, selectedCountries, selectedLocations]);

    // ── Ticket KPIs ─────────────────────────────────────────────
    const ticketKpis: TicketKpis = useMemo(() => {
        let activeIncident = 0;
        let activeCatalog = 0;
        let activeAsset = 0;
        let vipActive = 0;
        let agingIncidentGt2d = 0;
        let agingCatalogGt30d = 0;
        let agingAssetGt30d = 0;
        for (const r of activeTickets) {
            if (r.object_type === 'incident') activeIncident += 1;
            else if (r.object_type === 'request') {
                const rt = classifyRequestType(r);
                if (rt === 'asset_task') activeAsset += 1;
                else if (rt === 'catalog_task') activeCatalog += 1;
            }
            const isVip =
                (r as unknown as { is_vip?: boolean }).is_vip === true ||
                (r.actor as unknown as { is_vip?: boolean } | null)?.is_vip === true;
            if (isVip) vipActive += 1;
            const days = daysSinceUpdated(r, now);
            if (r.object_type === 'incident' && days > 2) agingIncidentGt2d += 1;
            if (r.object_type === 'request' && days > 30) {
                const rt = classifyRequestType(r);
                if (rt === 'asset_task') agingAssetGt30d += 1;
                else if (rt === 'catalog_task') agingCatalogGt30d += 1;
            }
        }
        return {
            totalActive: activeTickets.length,
            activeIncident,
            activeCatalog,
            activeAsset,
            vipActive,
            agingIncidentGt2d,
            agingCatalogGt30d,
            agingAssetGt30d,
        };
    }, [activeTickets, now]);

    const assetKpis = useMemo(() => summarizeAssets(filteredAssets), [filteredAssets]);

    // Month-over-month deltas — snapshot replays based on created_at +
    // closure timestamps. Skipped for the four aging KPIs since their
    // "snapshot at past time" depends on `source_updated_at`, which is
    // a moving target (no per-row history available).
    const ticketKpiDeltas: TicketKpiDeltas = useMemo(() => {
        const isVip = (r: TicketRow) =>
            (r as unknown as { is_vip?: boolean }).is_vip === true ||
            (r.actor as unknown as { is_vip?: boolean } | null)?.is_vip === true;
        const isCatalog = (r: TicketRow) =>
            r.object_type === 'request' && classifyRequestType(r) === 'catalog_task';
        const isAssetTask = (r: TicketRow) =>
            r.object_type === 'request' && classifyRequestType(r) === 'asset_task';
        return {
            totalActive: formatMoM(momActiveSnapshot(filteredTickets, now)),
            activeIncident: formatMoM(
                momActiveSnapshot(filteredTickets, now, (r) => r.object_type === 'incident'),
            ),
            activeCatalog: formatMoM(momActiveSnapshot(filteredTickets, now, isCatalog)),
            activeAsset: formatMoM(momActiveSnapshot(filteredTickets, now, isAssetTask)),
            vipActive: formatMoM(momActiveSnapshot(filteredTickets, now, isVip)),
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

    const inStockLocationSlices = useMemo(() => {
        const inStockRows = filteredAssets.filter(isInStock);
        // Group by the physical stock-room name ("Singapore SKY L6 IT
        // Stockroom", "Canada Office", …). Top-N keeps the donut
        // readable when the long tail of small rooms would otherwise
        // dominate the slice list.
        return groupBy(inStockRows, (r) => r.stock_room ?? 'Unknown')
            .slice(0, 8)
            .map((g) => ({ name: g.key, value: g.count }));
    }, [filteredAssets]);

    const procuredBySlices = useMemo(
        () =>
            groupBy(filteredAssets, procuredByOf)
                .slice(0, 8)
                .map((g) => ({ name: g.key, value: g.count })),
        [filteredAssets],
    );

    const supportGroupSlices = useMemo(
        () =>
            groupBy(filteredAssets, supportGroupOf)
                .slice(0, 8)
                .map((g) => ({ name: g.key, value: g.count })),
        [filteredAssets],
    );

    const supportGroupMatrix: SupportGroupMatrixRow[] = useMemo(() => {
        type Bucket = { name: string; Mac: number; Windows: number; Other: number; total: number };
        const buckets = new Map<string, Bucket>();
        for (const row of filteredAssets) {
            const key = supportGroupOf(row);
            const bucket = buckets.get(key) ?? { name: key, Mac: 0, Windows: 0, Other: 0, total: 0 };
            bucket[inferDeviceType(row.model_name)] += 1;
            bucket.total += 1;
            buckets.set(key, bucket);
        }
        return Array.from(buckets.values())
            .sort((a, b) => b.total - a.total)
            .slice(0, 10)
            .map((b) => ({
                ...b,
                displayName: b.name.length > 20 ? `${b.name.slice(0, 20)}…` : b.name,
            }));
    }, [filteredAssets]);

    // ── Cross-filter handlers ───────────────────────────────────
    // Generic toggle helpers — donut slice click and interactive
    // legend toggle both feed through these so the two stay in sync.
    const toggleTicketFilter = (param: string, name: string) => {
        const cur = (ticketFilters[param] as string[]) ?? [];
        const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
        setTicketFilters({ ...ticketFilters, [param]: next });
    };
    const toggleAssetFilter = (param: string, name: string) => {
        const cur = (assetFilters[param] as string[]) ?? [];
        const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
        setAssetFilters({ ...assetFilters, [param]: next });
    };
    const onGroupSliceClick = (slice: { name: string }) => toggleTicketFilter('assigned_group', slice.name);
    const onGroupLegendToggle = (name: string) => toggleTicketFilter('assigned_group', name);
    const onProcuredSliceClick = (slice: { name: string }) => toggleAssetFilter('procured_by', slice.name);
    const onProcuredLegendToggle = (name: string) => toggleAssetFilter('procured_by', name);
    const onSupportGroupSliceClick = (slice: { name: string }) => toggleAssetFilter('support_group', slice.name);
    const onSupportGroupLegendToggle = (name: string) => toggleAssetFilter('support_group', name);
    const onLocationSliceClick = (slice: { name: string }) => toggleAssetFilter('stock_room', slice.name);
    const onLocationLegendToggle = (name: string) => toggleAssetFilter('stock_room', name);

    const selectedAssignedGroups = (ticketFilters.assigned_group as string[]) ?? [];
    const selectedProcured = (assetFilters.procured_by as string[]) ?? [];
    const selectedSupportGroups = (assetFilters.support_group as string[]) ?? [];
    // Selected slices on the In-Stock Location donut — distinct from
    // the page-level `selectedLocations` (geographic filter). Tracks
    // the asset's `stock_room` field directly so the donut and its
    // legend display the chosen rooms by their full name.
    const selectedDonutLocations = (assetFilters.stock_room as string[]) ?? [];

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
        n += arr(assetFilters, 'support_group');
        n += arr(assetFilters, 'procured_by');
        n += arr(assetFilters, 'department');
        n += arr(assetFilters, 'region');
        const r = ticketFilters.created_at_from as { from: string | null; to: string | null } | undefined;
        if (r && (r.from !== defaultFromIso || r.to !== null)) n += 1;
        return n;
    }, [ticketFilters, assetFilters, defaultFromIso]);

    function resetAllParentFilters() {
        setTicketFilters({
            assigned_group: [],
            location: [],
            priority: [],
            created_at_from: { from: defaultFromIso, to: null },
            created_at_to: { from: defaultFromIso, to: null },
        });
        setAssetFilters({
            support_group: [],
            procured_by: [],
            department: [],
            stock_room: [],
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
                tickets (full geographic match) + assets (Region only via
                r.region). Open Date applies to tickets. Everything else
                is donut-driven (chart filters). Single Clear All button
                at the top-right. */}
            <TopFilterBar
                slicers={ticketSlicers}
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

                <AssetsPanel
                    kpis={assetKpis}
                    inStockLocationSlices={inStockLocationSlices}
                    procuredBySlices={procuredBySlices}
                    supportGroupSlices={supportGroupSlices}
                    supportGroupMatrix={supportGroupMatrix}
                    loading={loading}
                    filteredCount={filteredAssets.length}
                    totalCount={allAssets.length}
                    onProcuredSliceClick={onProcuredSliceClick}
                    onSupportGroupSliceClick={onSupportGroupSliceClick}
                    onLocationSliceClick={onLocationSliceClick}
                    selectedLocations={selectedDonutLocations}
                    onLocationLegendToggle={onLocationLegendToggle}
                    selectedProcured={selectedProcured}
                    onProcuredLegendToggle={onProcuredLegendToggle}
                    selectedSupportGroups={selectedSupportGroups}
                    onSupportGroupLegendToggle={onSupportGroupLegendToggle}
                />
            </div>
        </div>
    );
}
