'use client';

/**
 * In-Stock Assets (Page 1.3.2) — ports `temp_ref/.../in-stock-assets/InStockAssetsPage.tsx`.
 *
 * Base filter: model_category ∈ DASHBOARD_ASSET_CATEGORIES AND
 * `isInStock(row)`. Sidebar slicers pick among the surviving
 * categories + stockrooms distinct values.
 */

import { useMemo, useState } from 'react';
import { PackageCheck, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useHardwares } from '@/lib/hooks/useOpsDashboard';
import type { HardwareRow } from '@/lib/api/ops_dashboard';
import { groupBy, inferDeviceType, isInStock } from '@/lib/ops_dashboard/aggregate';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { DataTable, type ColDef } from '@/components/ops_dashboard/DataTable';
import { SidebarFilters, type FilterState, type SlicerConfig } from '@/components/ops_dashboard/filters/SidebarFilters';

const DASHBOARD_ASSET_CATEGORIES = new Set(['Computer', 'Desktop', 'Hardware', 'Server', 'Laptop']);
const DONUT_PALETTE = ['#118DFF', '#0B72D7', '#098BF5', '#54B5FB', '#71C0A7', '#57B956', '#478F48', '#326633'];
const PAGE_SIZE = 100;

interface TableRow extends Record<string, unknown> {
    oid: string;
    serial_number: string;
    asset_tag: string | null;
    model_category: string | null;
    model_name: string | null;
    model_display_name: string | null;
    asset_status: string | null;
    substatus: string | null;
    stock_room: string | null;
    region: string | null;
    residual_value: string | number | null;
    created_at: string;
    _residualNumber: number;
    _ageMonths: number;
    _ageFormatted: string;
    _deviceType: string;
    _createdFormatted: string;
}

function residualAsNumber(v: string | number | null): number {
    if (v === null || v === undefined) return 0;
    if (typeof v === 'number') return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function ageMonths(createdAt: string, now: number = Date.now()): number {
    const t = Date.parse(createdAt);
    if (!Number.isFinite(t)) return 0;
    const diffMs = now - t;
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.436875));
}

function formatAge(totalMonths: number): string {
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return `${years}y ${months}m`;
}

function formatShortDate(iso: string): string {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '-';
    return new Date(t).toLocaleDateString();
}

export function InStockAssetsDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const { data, loading, error, refetch } = useHardwares({
        limit: 1000,
        is_active: true,
    });
    const rows: HardwareRow[] = useMemo(() => data?.items ?? [], [data]);
    const partial = data?.partial === true;

    const [filters, setFilters] = useState<FilterState>({
        model_category: [],
        stock_room: [],
    });
    const [page, setPage] = useState<{ skip: number; limit: number }>({ skip: 0, limit: PAGE_SIZE });

    // Base set for this page: dashboard categories AND in-stock.
    const base = useMemo(
        () => rows.filter((r) => r.model_category && DASHBOARD_ASSET_CATEGORIES.has(r.model_category) && isInStock(r)),
        [rows],
    );

    const slicers: SlicerConfig[] = useMemo(() => {
        const categories = groupBy(base, (r) => r.model_category).map((g) => g.key);
        const stockrooms = groupBy(base, (r) => r.stock_room).map((g) => g.key);
        return [
            { type: 'multi', param: 'model_category', label: t('filters.modelCategory'), options: categories },
            { type: 'multi', param: 'stock_room', label: t('filters.stockroom'), options: stockrooms },
        ];
    }, [base, t]);

    const filtered = useMemo(() => {
        const catSel = (filters.model_category as string[]) ?? [];
        const stockSel = (filters.stock_room as string[]) ?? [];
        return base.filter((r) => {
            if (catSel.length && (!r.model_category || !catSel.includes(r.model_category))) return false;
            if (stockSel.length && !stockSel.includes(r.stock_room ?? 'Unknown')) return false;
            return true;
        });
    }, [base, filters]);

    // Enrich once so both KPIs and the table can consume the same derived fields.
    const enriched: TableRow[] = useMemo(() => {
        const now = Date.now();
        return filtered.map((r) => {
            const months = ageMonths(r.created_at, now);
            const enrichedRow: TableRow = {
                ...r,
                _residualNumber: residualAsNumber(r.residual_value),
                _ageMonths: months,
                _ageFormatted: formatAge(months),
                _deviceType: inferDeviceType(r.model_name),
                _createdFormatted: formatShortDate(r.created_at),
            };
            return enrichedRow;
        });
    }, [filtered]);

    // KPIs
    const kpis = useMemo(() => {
        const count = enriched.length;
        const residualK = enriched.reduce((s, r) => s + r._residualNumber, 0) / 1000;
        const avgMonths = count > 0 ? Math.round(enriched.reduce((s, r) => s + r._ageMonths, 0) / count) : 0;
        return {
            count,
            residual: `$${Math.round(residualK).toLocaleString()}K`,
            avgAge: count > 0 ? formatAge(avgMonths) : '—',
        };
    }, [enriched]);

    // Chart slices
    const locationSlices = useMemo(
        () =>
            groupBy(filtered, (r) => r.region)
                .slice(0, 8)
                .map((g) => ({ name: g.key, value: g.count })),
        [filtered],
    );
    const categorySlices = useMemo(
        () => groupBy(filtered, (r) => r.model_category).map((g) => ({ name: g.key, value: g.count })),
        [filtered],
    );
    const deviceTypeSlices = useMemo(() => {
        const counts = { Mac: 0, Windows: 0, Other: 0 };
        for (const r of filtered) counts[inferDeviceType(r.model_name)] += 1;
        return (Object.entries(counts) as [string, number][]).map(([name, value]) => ({ name, value }));
    }, [filtered]);

    // Table page
    const pageRows = useMemo(
        () => enriched.slice(page.skip, page.skip + page.limit),
        [enriched, page],
    );

    const cols: ColDef<TableRow>[] = useMemo(() => [
        { key: 'model_category', label: t('tables.modelCategory'), width: '120px' },
        { key: 'model_display_name', label: t('tables.model'), width: '200px', render: (r) => r.model_display_name ?? r.model_name ?? '-' },
        {
            key: 'serial_number',
            label: t('tables.serialNumber'),
            width: '180px',
            render: (r) => <span className="font-mono text-xs">{r.serial_number}</span>,
        },
        { key: 'stock_room', label: t('tables.stockRoom'), render: (r) => r.stock_room ?? '-' },
        {
            key: 'asset_status',
            label: t('tables.state'),
            width: '90px',
            render: (r) => (
                <span className={`px-1.5 py-0.5 rounded text-xs ${isLight ? 'bg-green-50 text-green-700' : 'bg-green-500/15 text-green-300'}`}>
                    {r.asset_status ?? '-'}
                </span>
            ),
        },
        { key: 'substatus', label: t('tables.substate'), width: '120px', render: (r) => r.substatus ?? '-' },
        { key: '_deviceType', label: t('tables.device'), width: '80px' },
        {
            key: 'residual_value',
            label: t('tables.residualValue'),
            width: '110px',
            render: (r) => (r._residualNumber > 0 ? `$${r._residualNumber.toLocaleString()}` : '-'),
            sortValue: (r) => r._residualNumber,
        },
        {
            key: '_ageFormatted',
            label: t('tables.age'),
            width: '90px',
            sortValue: (r) => r._ageMonths,
        },
        { key: '_createdFormatted', label: t('tables.created'), width: '120px' },
    ], [t, isLight]);

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';

    return (
        <div className={`flex h-[calc(100vh-4rem)] ${isLight ? 'bg-slate-50' : ''}`}>
            <div className="flex-1 flex flex-col overflow-hidden p-4 min-w-0">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                            <PackageCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.inStockTitle')}</h1>
                            <p className={`text-sm mt-0.5 ${textMuted}`}>{t('pages.inStockSubtitle')}</p>
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

                {/* KPI + donut row */}
                <div className="grid grid-cols-6 gap-3 mb-3 shrink-0">
                    <KpiCard label={t('kpis.inStock')} value={kpis.count} icon={PackageCheck} />
                    <KpiCard label={t('pages.totalResidual')} value={kpis.residual} icon={DollarSign} />
                    <KpiCard label={t('pages.avgAge')} value={kpis.avgAge} icon={Calendar} />
                    <DonutCard
                        title={t('charts.inStockLocation')}
                        data={locationSlices}
                        palette={DONUT_PALETTE}
                        height={150}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <DonutCard
                        title={t('charts.byCategory')}
                        data={categorySlices}
                        palette={DONUT_PALETTE}
                        height={150}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <DonutCard
                        title={t('charts.deviceType')}
                        data={deviceTypeSlices}
                        palette={DONUT_PALETTE}
                        height={150}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>

                {/* Table */}
                <div className="flex-1 min-h-0">
                    <DataTable<TableRow>
                        rows={pageRows}
                        cols={cols}
                        searchKeys={['serial_number', 'model_display_name', 'model_name', 'stock_room', 'model_category'] as (keyof TableRow)[]}
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
                    />
                </div>
            </div>

            {/* Sidebar */}
            <div className={`w-60 shrink-0 border-l p-4 overflow-auto ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/10'}`}>
                <SidebarFilters slicers={slicers} value={filters} onChange={(next) => { setFilters(next); setPage({ skip: 0, limit: PAGE_SIZE }); }} />
            </div>
        </div>
    );
}
