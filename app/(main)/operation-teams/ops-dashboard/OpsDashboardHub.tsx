'use client';

/**
 * Active Monitoring Hub (Page 1.3.10) — combines active-ticket
 * monitoring with the hardware-fleet overview in a single page.
 *
 * Data sources (three concurrent fetches):
 *   - useIncidents({ oit_only, limit: 1000 })
 *   - useRequests({ oit_only, limit: 1000 })
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
    groupBy,
    inferDeviceType,
    isActiveState,
    isInStock,
    summarizeAssets,
    trendByMonth,
} from '@/lib/ops_dashboard/aggregate';
import { type Region, type RegionBubble } from '@/components/ops_dashboard/RegionMap';
import {
    SidebarFilters,
    type FilterState,
    type SlicerConfig,
} from '@/components/ops_dashboard/filters/SidebarFilters';
import { TicketsPanel, type TicketKpis } from './TicketsPanel';
import { AssetsPanel, type SupportGroupMatrixRow } from './AssetsPanel';

const DASHBOARD_ASSET_CATEGORIES = new Set(['Computer', 'Desktop', 'Hardware', 'Server', 'Laptop']);

function locationOf(row: TicketRow): string {
    return row.actor?.location?.descriptor?.trim() || 'Unknown';
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
    return row.company?.trim() || 'Unknown';
}

function supportGroupOf(row: HardwareRow): string {
    return row.department?.trim() || 'Unknown';
}

export function OpsDashboardHub() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // ── Three concurrent fetches ─────────────────────────────────
    const incidentQuery = useIncidents({ limit: 1000, oit_only: true, view: 'slim' });
    const requestQuery = useRequests({ limit: 1000, oit_only: true, view: 'slim' });
    const hardwareQuery = useHardwares({ limit: 1000, is_active: true, view: 'slim' });

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

    // ── Filter state ────────────────────────────────────────────
    const [ticketFilters, setTicketFilters] = useState<FilterState>({
        assigned_group: [],
        location: [],
        priority: [],
        created_at_from: { from: null, to: null },
        created_at_to: { from: null, to: null },
    });
    const [assetFilters, setAssetFilters] = useState<FilterState>({
        support_group: [],
        procured_by: [],
        department: [],
    });

    const ticketSlicers: SlicerConfig[] = useMemo(() => {
        const groups = groupBy(allTickets, (r) => r.assigned_group).map((g) => g.key);
        const locations = groupBy(allTickets, locationOf).map((g) => g.key);
        const priorities = groupBy(allTickets, (r) => r.priority)
            .map((g) => g.key)
            .sort();
        return [
            { type: 'multi', param: 'assigned_group', label: t('filters.assignmentGroup'), options: groups },
            { type: 'multi', param: 'location', label: t('filters.location'), options: locations },
            { type: 'multi', param: 'priority', label: t('filters.priority'), options: priorities },
            { type: 'date-range', param: ['created_at_from', 'created_at_to'], label: t('filters.opened') },
        ];
    }, [allTickets, t]);

    const assetSlicers: SlicerConfig[] = useMemo(() => {
        const supportGroups = groupBy(allAssets, supportGroupOf).map((g) => g.key);
        const procured = groupBy(allAssets, procuredByOf).map((g) => g.key);
        const departments = groupBy(allAssets, (r) => r.department).map((g) => g.key);
        return [
            { type: 'multi', param: 'support_group', label: t('filters.supportGroup'), options: supportGroups },
            { type: 'multi', param: 'procured_by', label: t('filters.procuredBy'), options: procured },
            { type: 'multi', param: 'department', label: t('filters.department'), options: departments },
        ];
    }, [allAssets, t]);

    // ── Filtered tickets (sidebar + date range) ─────────────────
    const filteredTickets = useMemo(() => {
        const groupSel = (ticketFilters.assigned_group as string[]) ?? [];
        const locSel = (ticketFilters.location as string[]) ?? [];
        const prioSel = (ticketFilters.priority as string[]) ?? [];
        const range =
            (ticketFilters.created_at_from as { from: string | null; to: string | null }) ??
            { from: null, to: null };
        return allTickets.filter((r) => {
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
    }, [allTickets, ticketFilters]);

    const activeTickets = useMemo(
        () => filteredTickets.filter((r) => isActiveState(r.state)),
        [filteredTickets],
    );

    // ── Filtered assets ─────────────────────────────────────────
    const filteredAssets = useMemo(() => {
        const supportGroupSel = (assetFilters.support_group as string[]) ?? [];
        const procuredSel = (assetFilters.procured_by as string[]) ?? [];
        const deptSel = (assetFilters.department as string[]) ?? [];
        return allAssets.filter((r) => {
            if (supportGroupSel.length && !supportGroupSel.includes(supportGroupOf(r))) return false;
            if (procuredSel.length && !procuredSel.includes(procuredByOf(r))) return false;
            if (deptSel.length && !deptSel.includes(r.department ?? 'Unknown')) return false;
            return true;
        });
    }, [allAssets, assetFilters]);

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

    // ── Chart data ──────────────────────────────────────────────
    const groupDonut = useMemo(
        () =>
            groupBy(activeTickets, (r) => r.assigned_group)
                .slice(0, 8)
                .map((g) => ({ name: g.key, value: g.count })),
        [activeTickets],
    );

    const trend = useMemo(() => trendByMonth(filteredTickets, 10, now), [filteredTickets, now]);

    const regionData: RegionBubble[] = useMemo(() => {
        const counts: Record<Region, number> = { AMER: 0, EMEA: 0, APAC: 0, OTHER: 0 };
        for (const r of activeTickets) counts[regionOf(r)] += 1;
        return (Object.keys(counts) as Region[]).map((region) => ({ region, count: counts[region] }));
    }, [activeTickets]);

    const inStockLocationSlices = useMemo(() => {
        const inStockRows = filteredAssets.filter(isInStock);
        return groupBy(inStockRows, (r) => r.region)
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
    const onGroupSliceClick = (slice: { name: string }) => {
        const cur = (ticketFilters.assigned_group as string[]) ?? [];
        const next = cur.includes(slice.name) ? cur.filter((x) => x !== slice.name) : [...cur, slice.name];
        setTicketFilters({ ...ticketFilters, assigned_group: next });
    };

    const onProcuredSliceClick = (slice: { name: string }) => {
        const cur = (assetFilters.procured_by as string[]) ?? [];
        const next = cur.includes(slice.name) ? cur.filter((x) => x !== slice.name) : [...cur, slice.name];
        setAssetFilters({ ...assetFilters, procured_by: next });
    };

    const onSupportGroupSliceClick = (slice: { name: string }) => {
        const cur = (assetFilters.support_group as string[]) ?? [];
        const next = cur.includes(slice.name) ? cur.filter((x) => x !== slice.name) : [...cur, slice.name];
        setAssetFilters({ ...assetFilters, support_group: next });
    };

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';

    const allTicketsActive = useMemo(
        () => allTickets.filter((r) => isActiveState(r.state)).length,
        [allTickets],
    );

    return (
        <div className={`flex h-[calc(100vh-4rem)] ${isLight ? 'bg-slate-50' : ''}`}>
            {/* Main content */}
            <div className="flex-1 overflow-auto p-4 min-w-0">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
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
                    groupDonut={groupDonut}
                    trend={trend}
                    regionData={regionData}
                    loading={loading}
                    filteredCount={activeTickets.length}
                    totalActiveCount={allTicketsActive}
                    onGroupSliceClick={onGroupSliceClick}
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
                />
            </div>

            {/* Right sidebar — two stacked panels */}
            <div className={`w-60 shrink-0 border-l p-4 overflow-auto ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/10'}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${textMuted}`}>
                    {t('pages.hubTicketsSection')}
                </p>
                <SidebarFilters slicers={ticketSlicers} value={ticketFilters} onChange={setTicketFilters} />
                <div className={`my-4 border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`} />
                <p className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${textMuted}`}>
                    {t('pages.hubAssetsSection')}
                </p>
                <SidebarFilters slicers={assetSlicers} value={assetFilters} onChange={setAssetFilters} />
            </div>
        </div>
    );
}
