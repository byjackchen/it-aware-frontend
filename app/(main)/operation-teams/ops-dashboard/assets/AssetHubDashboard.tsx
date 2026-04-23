'use client';

/**
 * Asset Hub (Page 1.3.1) — ports `temp_ref/.../assets/AssetsDashboardPage.tsx`
 * to the real API via {@link useHardwares}.
 *
 * Base filter: model_category ∈ DASHBOARD_ASSET_CATEGORIES. We pull the
 * data with no category filter (Phase 1 backend param is single-value)
 * and narrow client-side — `limit=1000` plus active-only covers
 * reasonable dashboard volumes.
 */

import { useMemo, useState } from 'react';
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
    isInStock,
} from '@/lib/ops_dashboard/aggregate';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { TopFilterBar, type FilterState, type SlicerConfig } from '@/components/ops_dashboard/filters/TopFilterBar';

const DASHBOARD_ASSET_CATEGORIES = new Set(['Computer', 'Desktop', 'Hardware', 'Server', 'Laptop']);
const MAC_COLOR = '#6366f1';
const WIN_COLOR = '#3b82f6';
const OTHER_COLOR = '#0ea5e9';
const DONUT_PALETTE = ['#1d4ed8', '#0ea5e9', '#06b6d4', '#0891b2', '#0284c7', '#0369a1', '#075985', '#1e3a5f'];
const TOP_LOCATIONS = 8;

function procuredByOf(row: HardwareRow): string {
    // The backend HardwareRow doesn't carry `procured_cost_center` or
    // `erp_created_by` in the slim view. `company` is the closest field
    // (ownership / billing entity) — fall back to Unknown.
    return row.company?.trim() || 'Unknown';
}

function supportGroupOf(row: HardwareRow): string {
    // No dedicated support_group field on HardwareRow — `department`
    // is the closest populated field.
    return row.department?.trim() || 'Unknown';
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

    // Sidebar filter state — all three slicers are controlled here.
    const [filters, setFilters] = useState<FilterState>({
        support_group: [],
        procured_by: [],
        department: [],
    });

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
        const supportGroupSel = (filters.support_group as string[]) ?? [];
        const procuredSel = (filters.procured_by as string[]) ?? [];
        const deptSel = (filters.department as string[]) ?? [];
        return rows.filter((r) => {
            if (!r.model_category || !DASHBOARD_ASSET_CATEGORIES.has(r.model_category)) return false;
            if (supportGroupSel.length && !supportGroupSel.includes(supportGroupOf(r))) return false;
            if (procuredSel.length && !procuredSel.includes(procuredByOf(r))) return false;
            if (deptSel.length && !deptSel.includes(r.department ?? 'Unknown')) return false;
            return true;
        });
    }, [rows, filters]);

    const kpis = useMemo(() => summarizeAssets(filtered), [filtered]);

    const procuredBySlices = useMemo(() => {
        return groupBy(filtered, procuredByOf)
            .slice(0, 8)
            .map((g) => ({ name: g.key, value: g.count }));
    }, [filtered]);

    const inStockLocationSlices = useMemo(() => {
        const inStockRows = filtered.filter(isInStock);
        return groupBy(inStockRows, (r) => r.region)
            .slice(0, TOP_LOCATIONS)
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

    const onProcuredSliceClick = (slice: { name: string }) => {
        const cur = (filters.procured_by as string[]) ?? [];
        const next = cur.includes(slice.name) ? cur.filter((x) => x !== slice.name) : [...cur, slice.name];
        setFilters({ ...filters, procured_by: next });
    };

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';
    const cardBg = isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10';
    const axisStroke = isLight ? '#94a3b8' : '#64748b';

    const hasFilters = (Object.values(filters) as string[][]).some((v) => Array.isArray(v) && v.length > 0);
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
                                total: rows.filter((r) => r.model_category && DASHBOARD_ASSET_CATEGORIES.has(r.model_category)).length.toLocaleString(),
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
                value={filters}
                onChange={setFilters}
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

                {/* Row 1: Total + In Stock Rate + donuts */}
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <div className="flex flex-col gap-3">
                        <KpiCard label={t('kpis.totalAssets')} value={kpis.total} icon={HardDrive} />
                        <div className={`rounded-xl border p-4 ${cardBg}`}>
                            <p className={`text-[10px] uppercase tracking-wide ${textMuted}`}>{t('kpis.inStockRate')}</p>
                            <p className={`text-3xl font-bold mt-1.5 ${inStockPctCritical ? 'text-red-400' : textMain}`}>
                                {kpis.total > 0 ? `${inStockPct}%` : '—'}
                            </p>
                        </div>
                    </div>

                    <DonutCard
                        title={t('charts.procuredBy')}
                        subtitle={t('charts.procuredBySubtitle')}
                        data={procuredBySlices}
                        palette={DONUT_PALETTE}
                        height={200}
                        onSliceClick={onProcuredSliceClick}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />

                    <DonutCard
                        title={t('charts.inStockLocation')}
                        data={inStockLocationSlices}
                        palette={DONUT_PALETTE}
                        height={200}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>

                {/* Row 2: KPI tiles */}
                <div className="grid grid-cols-5 gap-3 mb-3">
                    <KpiCard label={t('kpis.inStock')} value={kpis.inStock} icon={PackageCheck} />
                    <KpiCard label={t('kpis.pendingReturn')} value={kpis.pendingReturn} icon={Truck} />
                    <KpiCard label={t('kpis.pendingRepair')} value={kpis.pendingRepair} icon={Wrench} />
                    <KpiCard label={t('kpis.unconfirmed')} value={kpis.unconfirmed} icon={HelpCircle} />
                    <KpiCard label={t('kpis.zeroResidual')} value={kpis.zeroResidual} icon={DollarSign} />
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
