'use client';

/**
 * Asset Hub (Page 1.3.1) — ports `temp_ref/.../assets/AssetsDashboardPage.tsx`
 * to the real API via {@link useHardwares}.
 *
 * Base filter: model_category whitelisted via `isInScopeAsset`. We pull the
 * data with no category filter (Phase 1 backend param is single-value)
 * and narrow client-side — `limit=1000` plus active-only covers
 * reasonable dashboard volumes.
 */

import { useCallback, useMemo, useState } from 'react';
import { BarChart3, HardDrive, PackageCheck, Truck, Wrench, HelpCircle, DollarSign, RefreshCw } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useHardwares } from '@/lib/hooks/useOpsDashboard';
import type { HardwareRow } from '@/lib/api/ops_dashboard';
import {
    summarizeAssets,
    groupBy,
    inferDeviceType,
    isInScopeAsset,
    isInStock,
} from '@/lib/ops_dashboard/aggregate';
import {
    countryToRegion,
    extractCountry,
    normalizeRegion,
} from '@/lib/ops_dashboard/region';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { TopFilterBar, type FilterState, type SlicerConfig } from '@/components/ops_dashboard/filters/TopFilterBar';
import { useOpsAssetFilter } from '@/lib/hooks/useOpsAssetFilter';

const MAC_COLOR = '#6366f1';
const WIN_COLOR = '#3b82f6';
const OTHER_COLOR = '#0ea5e9';
const DONUT_PALETTE = ['#1d4ed8', '#0ea5e9', '#06b6d4', '#0891b2', '#0284c7', '#0369a1', '#075985', '#1e3a5f'];
const TOP_LOCATIONS = 8;

function procuredByOf(row: HardwareRow): string {
    // `asset_owner` is the procurement-side ownership label (typically
    // "OIT" or "Studio"). Earlier code used `company` which is the
    // legal-entity buyer — not the same concept.
    return row.asset_owner?.trim() || 'Unknown';
}

function supportGroupOf(row: HardwareRow): string {
    // Region fallback chain: office_region → region → region_code →
    // location as region label → location-derived country → stock_room
    // -derived country. Only assets with nothing identifiable land
    // in "Unassigned".
    const r =
        normalizeRegion(row.office_region) ??
        normalizeRegion(row.region) ??
        normalizeRegion(row.region_code) ??
        normalizeRegion(row.location) ??
        countryToRegion(extractCountry(row.location)) ??
        countryToRegion(row.stock_room);
    return r ? `${r} OIT Support` : 'Unassigned';
}

export function AssetHubDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const { data, loading, error, refetch } = useHardwares(
        { limit: 1000, is_active: true },
        { fetchAll: true },
    );
    const rows: HardwareRow[] = useMemo(() => data?.items ?? [], [data]);
    const partial = data?.partial === true;

    // Sidebar filter state — three slicers + a chart-only
    // `stock_room` dimension driven exclusively by the In-Stock
    // Location donut (no panel slicer for it). Support Group /
    // Procured By / Department are SHARED across every asset-oriented
    // dashboard via useOpsAssetFilter — picking "AMER OIT Support"
    // on Asset Overview carries to In-Stock / Pending / Zero Residual.
    const {
        filter: assetFilter,
        setSupportGroups,
        setProcuredBy,
        setDepartments,
    } = useOpsAssetFilter();
    const [filters, setFilters] = useState<FilterState>({
        stock_room: [],
    });
    // Mirror the three shared dims into the legacy FilterState shape
    // the TopFilterBar expects. Updates flow back into the global hook.
    const filterStateForBar: FilterState = useMemo(
        () => ({
            ...filters,
            support_group: assetFilter.supportGroups,
            procured_by: assetFilter.procuredBy,
            department: assetFilter.departments,
        }),
        [filters, assetFilter],
    );
    const onFilterStateChange = useCallback(
        (next: FilterState) => {
            // Pull the three shared dims out and route them through
            // the global hook. Everything else (stock_room) stays local.
            const supportGroups = (next.support_group as string[]) ?? [];
            const procuredBy = (next.procured_by as string[]) ?? [];
            const departments = (next.department as string[]) ?? [];
            if (JSON.stringify(supportGroups) !== JSON.stringify(assetFilter.supportGroups)) {
                setSupportGroups(supportGroups);
            }
            if (JSON.stringify(procuredBy) !== JSON.stringify(assetFilter.procuredBy)) {
                setProcuredBy(procuredBy);
            }
            if (JSON.stringify(departments) !== JSON.stringify(assetFilter.departments)) {
                setDepartments(departments);
            }
            const localOnly: FilterState = { ...next };
            delete localOnly.support_group;
            delete localOnly.procured_by;
            delete localOnly.department;
            setFilters(localOnly);
        },
        [assetFilter, setSupportGroups, setProcuredBy, setDepartments],
    );

    // Option pools derive from the fetched data.
    const slicers: SlicerConfig[] = useMemo(() => {
        const supportGroups = groupBy(rows, supportGroupOf).map((g) => g.key);
        const procured = groupBy(rows, procuredByOf).map((g) => g.key);
        const departments = groupBy(rows, (r) => r.department).map((g) => g.key);
        return [
            {
                type: 'multi',
                param: 'support_group',
                label: t('filters.supportGroup'),
                options: supportGroups,
                clientSide: true,
            },
            {
                type: 'multi',
                param: 'procured_by',
                label: t('filters.procuredBy'),
                options: procured,
                clientSide: true,
            },
            {
                type: 'multi',
                param: 'department',
                label: t('filters.department'),
                options: departments,
                clientSide: true,
            },
        ];
    }, [rows, t]);

    // Base set: dashboard model categories + user sidebar slicers applied.
    const filtered = useMemo(() => {
        const supportGroupSel = assetFilter.supportGroups;
        const procuredSel = assetFilter.procuredBy;
        const deptSel = assetFilter.departments;
        const stockRoomSel = (filters.stock_room as string[]) ?? [];
        return rows.filter((r) => {
            if (!isInScopeAsset(r)) return false;
            if (supportGroupSel.length && !supportGroupSel.includes(supportGroupOf(r))) return false;
            if (procuredSel.length && !procuredSel.includes(procuredByOf(r))) return false;
            if (deptSel.length && !deptSel.includes(r.department ?? 'Unknown')) return false;
            if (stockRoomSel.length && !stockRoomSel.includes(r.stock_room ?? 'Unknown')) return false;
            return true;
        });
    }, [rows, filters, assetFilter]);

    const kpis = useMemo(() => summarizeAssets(filtered), [filtered]);

    const procuredBySlices = useMemo(() => {
        return groupBy(filtered, procuredByOf)
            .slice(0, 8)
            .map((g) => ({ name: g.key, value: g.count }));
    }, [filtered]);

    const inStockLocationSlices = useMemo(() => {
        const inStockRows = filtered.filter(isInStock);
        // Group by physical stock-room name. Top-N caps the long tail
        // of small rooms so the donut stays readable.
        return groupBy(inStockRows, (r) => r.stock_room ?? 'Unknown')
            .slice(0, TOP_LOCATIONS)
            .map((g) => ({ name: g.key, value: g.count }));
    }, [filtered]);

    // Asset status / substatus donuts — split the inventory by SN's
    // status taxonomy. Top 8 keeps each donut legible; the long tail
    // collapses into "Unknown" if the SN row didn't carry a value.
    const statusSlices = useMemo(() => {
        return groupBy(filtered, (r) => r.asset_status ?? 'Unknown')
            .slice(0, 8)
            .map((g) => ({ name: g.key, value: g.count }));
    }, [filtered]);
    const substatusSlices = useMemo(() => {
        return groupBy(filtered, (r) => r.substatus ?? 'Unknown')
            .slice(0, 8)
            .map((g) => ({ name: g.key, value: g.count }));
    }, [filtered]);

    const supportGroupMatrix = useMemo(() => {
        type Bucket = { name: string; Mac: number; Windows: number; Other: number; total: number };
        const buckets = new Map<string, Bucket>();
        for (const row of filtered) {
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
    }, [filtered]);

    // Generic toggle helper — both donut slice clicks and interactive
    // legend toggles plumb through here so the two stay in sync.
    const toggleFilter = (param: string, name: string) => {
        const cur = (filters[param] as string[]) ?? [];
        const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
        setFilters({ ...filters, [param]: next });
    };
    const onProcuredSliceClick = (slice: { name: string }) => toggleFilter('procured_by', slice.name);
    const onProcuredLegendToggle = (name: string) => toggleFilter('procured_by', name);
    const onLocationSliceClick = (slice: { name: string }) => toggleFilter('stock_room', slice.name);
    const onLocationLegendToggle = (name: string) => toggleFilter('stock_room', name);
    const selectedProcured = (filters.procured_by as string[]) ?? [];
    const selectedStockRooms = (filters.stock_room as string[]) ?? [];

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';
    const cardBg = isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10';
    const axisStroke = isLight ? '#94a3b8' : '#64748b';

    const hasFilters =
        (Object.values(filters) as string[][]).some((v) => Array.isArray(v) && v.length > 0) ||
        assetFilter.supportGroups.length > 0 ||
        assetFilter.procuredBy.length > 0 ||
        assetFilter.departments.length > 0;
    const inStockPct = kpis.inStockRatePct;
    const inStockPctCritical = kpis.total > 0 && inStockPct < 70;

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] overflow-hidden p-4 gap-3 ${isLight ? 'bg-slate-50' : ''}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                        <BarChart3 className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.assetsTitle')}</h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>{t('pages.assetsSubtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {hasFilters && (
                        <span className="text-xs text-blue-400">
                            {t('pages.filteredCount', {
                                filtered: filtered.length.toLocaleString(),
                                total: rows.filter(isInScopeAsset).length.toLocaleString(),
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

            {/* Filters */}
            <TopFilterBar
                slicers={slicers}
                value={filterStateForBar}
                onChange={onFilterStateChange}
                storageKey="ops-dashboard:assets:filters"
                title={t('filters.title')}
                clearLabel={t('filters.clearAll')}
                clientSideTooltip={t('filters.clientSideTooltip')}
            />

            {/* Scrollable main content */}
            <div className="flex-1 min-h-0 overflow-auto">
                {/* Loading / error / partial banners */}
                {partial && (
                    <div className={`rounded-xl border p-3 mb-3 text-xs flex items-center gap-2 ${isLight ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                        <span>{t('empty.partialResult')}</span>
                        <button onClick={() => void refetch()} className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${isLight ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200'}`}>{t('empty.retry')}</button>
                    </div>
                )}
                {error && !partial && (
                    <div className={`rounded-xl border p-3 mb-3 text-xs flex items-center gap-2 ${isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                        <span>{error}</span>
                        <button onClick={() => void refetch()} className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${isLight ? 'bg-red-100 hover:bg-red-200 text-red-800' : 'bg-red-500/20 hover:bg-red-500/30 text-red-200'}`}>{t('empty.retry')}</button>
                    </div>
                )}

                {/* Row 1: Total + In Stock Rate + donuts.
                    Column 1 uses `grid-rows-2` + `h-full` so the two
                    big-number tiles each fill half the column height
                    and the row visually matches the taller donut
                    cards on the right (no empty padding below). */}
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <div className="grid grid-rows-3 gap-3">
                        <KpiCard
                            label={t('kpis.totalAssets')}
                            value={kpis.total}
                            icon={HardDrive}
                            className="h-full flex flex-col justify-center"
                            tooltip={t('kpis.totalAssetsInfo')}
                        />
                        <KpiCard
                            label={t('kpis.activeHardware')}
                            value={kpis.activeAsset}
                            className="h-full flex flex-col justify-center"
                            tooltip={t('kpis.activeHardwareInfo')}
                        />
                        <div
                            className={`rounded-xl border p-4 h-full flex flex-col justify-center ${cardBg}`}
                        >
                            <p className={`text-[10px] uppercase tracking-wide ${textMuted}`}>{t('kpis.inStockRate')}</p>
                            <p className={`text-4xl font-bold mt-1.5 ${inStockPctCritical ? 'text-red-400' : textMain}`}>
                                {kpis.total > 0 ? `${inStockPct}%` : '—'}
                            </p>
                            <p className={`text-[10px] mt-1 ${textMuted}`}>
                                {t('kpis.inStockRateInfo')}
                            </p>
                        </div>
                    </div>

                    <DonutCard
                        title={t('charts.procuredBy')}
                        subtitle={t('charts.procuredBySubtitle')}
                        info={t('charts.procuredByInfo')}
                        data={procuredBySlices}
                        palette={DONUT_PALETTE}
                        height={200}
                        onSliceClick={onProcuredSliceClick}
                        selectedSlices={selectedProcured}
                        onLegendToggle={onProcuredLegendToggle}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />

                    <DonutCard
                        title={t('charts.inStockLocation')}
                        info={t('charts.inStockLocationInfo')}
                        data={inStockLocationSlices}
                        palette={DONUT_PALETTE}
                        height={200}
                        onSliceClick={onLocationSliceClick}
                        selectedSlices={selectedStockRooms}
                        onLegendToggle={onLocationLegendToggle}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>

                {/* Row 1b: status + substatus donuts. Two-column grid
                    so they sit beside one another at the same width as
                    the donuts above. */}
                <div className="grid gap-3 mb-3 grid-cols-2">
                    <DonutCard
                        title={t('charts.assetsByStatus')}
                        info={t('charts.assetsByStatusInfo')}
                        data={statusSlices}
                        palette={DONUT_PALETTE}
                        height={220}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <DonutCard
                        title={t('charts.assetsBySubstatus')}
                        info={t('charts.assetsBySubstatusInfo')}
                        data={substatusSlices}
                        palette={DONUT_PALETTE}
                        height={220}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>

                {/* Row 2: KPI tiles */}
                <div className="grid grid-cols-5 gap-3 mb-3">
                    <KpiCard
                        label={t('kpis.inStock')}
                        value={kpis.inStock}
                        icon={PackageCheck}
                        linkHref="/operation-teams/ops-dashboard/in-stock-assets"
                        linkLabel={t('links.openInStockAssets')}
                    />
                    <KpiCard
                        label={t('kpis.pendingReturn')}
                        value={kpis.pendingReturn}
                        icon={Truck}
                        linkHref="/operation-teams/ops-dashboard/pending-assets"
                        linkLabel={t('links.openPendingAssets')}
                    />
                    <KpiCard
                        label={t('kpis.pendingRepair')}
                        value={kpis.pendingRepair}
                        icon={Wrench}
                        linkHref="/operation-teams/ops-dashboard/pending-assets"
                        linkLabel={t('links.openPendingAssets')}
                    />
                    <KpiCard
                        label={t('kpis.unconfirmed')}
                        value={kpis.unconfirmed}
                        icon={HelpCircle}
                        linkHref="/operation-teams/ops-dashboard/pending-assets"
                        linkLabel={t('links.openPendingAssets')}
                    />
                    <KpiCard
                        label={t('kpis.zeroResidual')}
                        value={kpis.zeroResidual}
                        icon={DollarSign}
                        linkHref="/operation-teams/ops-dashboard/zero-residual-assets"
                        linkLabel={t('links.openZeroResidualAssets')}
                    />
                </div>

                {/* Row 3: Support-group × device-type stacked bar (inline recharts -- GroupBarCard does not support stacked) */}
                <div className={`rounded-xl border p-4 ${cardBg}`}>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className={`text-sm font-medium ${textMain}`}>{t('charts.supportGroupDevice')}</h3>
                        <div className={`flex gap-4 text-xs ${textMuted}`}>
                            {[
                                { color: MAC_COLOR, label: t('charts.legendMac') },
                                { color: WIN_COLOR, label: t('charts.legendWindows') },
                                { color: OTHER_COLOR, label: t('charts.legendOther') },
                            ].map(({ color, label }) => (
                                <span key={label} className="flex items-center gap-1">
                                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: color }} />
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>
                    {supportGroupMatrix.length === 0 ? (
                        <div className={`text-center text-xs py-8 ${textMuted}`}>
                            {loading ? t('empty.loading') : t('empty.noData')}
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={supportGroupMatrix} margin={{ top: 8, right: 10, left: -10, bottom: 28 }}>
                                <XAxis
                                    dataKey="displayName"
                                    tick={{ fontSize: 10, fill: axisStroke }}
                                    axisLine={false}
                                    tickLine={false}
                                    angle={-30}
                                    textAnchor="end"
                                    interval={0}
                                />
                                <YAxis tick={{ fontSize: 10, fill: axisStroke }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: isLight ? '#fff' : '#1e293b',
                                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                    }}
                                />
                                <Bar dataKey="Mac" stackId="a" fill={MAC_COLOR} />
                                <Bar dataKey="Windows" stackId="a" fill={WIN_COLOR} />
                                <Bar dataKey="Other" stackId="a" fill={OTHER_COLOR} radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}
