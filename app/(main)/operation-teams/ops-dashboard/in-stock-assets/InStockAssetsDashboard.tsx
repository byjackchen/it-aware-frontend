'use client';

/**
 * In-Stock Assets (Page 1.3.2) — ports `temp_ref/.../in-stock-assets/InStockAssetsPage.tsx`.
 *
 * Base filter: model_category whitelisted via `isInScopeAsset` AND
 * `isInStock(row)`. Sidebar slicers pick among the surviving
 * categories + stockrooms distinct values.
 */

import { useCallback, useMemo, useState } from 'react';
import { PackageCheck, DollarSign, Calendar, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useHardwares } from '@/lib/hooks/useOpsDashboard';
import type { HardwareRow } from '@/lib/api/ops_dashboard';
import { groupBy, inferDeviceType, isInScopeAsset, isInStock, modelFamily } from '@/lib/ops_dashboard/aggregate';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { GroupBarCard } from '@/components/ops_dashboard/GroupBarCard';
import { DataTable, type ColDef } from '@/components/ops_dashboard/DataTable';
import { TopFilterBar, type FilterState, type SlicerConfig } from '@/components/ops_dashboard/filters/TopFilterBar';
import { useOpsAssetFilter } from '@/lib/hooks/useOpsAssetFilter';
import { countryToRegion, extractCountry, normalizeRegion } from '@/lib/ops_dashboard/region';
import { TranslatedAutoRefresh } from '@/components/ops_dashboard/TranslatedAutoRefresh';

/**
 * Support-group classifier — same region-fallback chain Asset Hub
 * uses so the shared filter speaks a common vocabulary across every
 * asset-oriented dashboard.
 */
function supportGroupOf(row: HardwareRow): string {
    const r =
        normalizeRegion(row.office_region) ??
        normalizeRegion(row.region) ??
        normalizeRegion(row.region_code) ??
        normalizeRegion(row.location) ??
        countryToRegion(extractCountry(row.location)) ??
        countryToRegion(row.stock_room);
    return r ? `${r} OIT Support` : 'Unassigned';
}

/**
 * Procured-by classifier — mirrors Asset Hub: prefer explicit
 * ``asset_owner`` (procurement entity — OIT / Studio / …) because the
 * SN ``company`` column is the legal-entity buyer, not the same concept.
 */
function procuredByOf(row: HardwareRow): string {
    return row.asset_owner?.trim() || 'Unknown';
}

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

/**
 * Approximate hardware age in months from the asset's true
 * procurement/creation timestamp.
 *
 * Source priority:
 *   1. erp_created_date  — SN/ERP-side asset record creation
 *   2. first_assigned_date — first time it was given to a user
 *   3. created_at        — our DB sync time (almost always recent;
 *                          previous implementation used this alone
 *                          and every asset looked < 1 month old)
 */
function ageMonths(row: HardwareRow, now: number = Date.now()): number {
    const candidate = row.erp_created_date ?? row.first_assigned_date ?? row.created_at;
    if (!candidate) return 0;
    const t = Date.parse(candidate);
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

    const { data, loading, error, refetch } = useHardwares(
        { limit: 1000, is_active: true },
        { fetchAll: true },
    );
    const rows: HardwareRow[] = useMemo(() => data?.items ?? [], [data]);
    const partial = data?.partial === true;

    // model_category + stock_room come from both the panel slicers
    // AND the matching donut chart filters (the donut click toggles
    // the same filter param). device_type is donut-only.
    const [filters, setFilters] = useState<FilterState>({
        model_category: [],
        stock_room: [],
        device_type: [],
    });

    // Support Group / Procured By / Department are SHARED across
    // every asset-oriented dashboard via useOpsAssetFilter — picking
    // AMER OIT Support on any asset page carries to the others.
    const {
        filter: assetFilter,
        setSupportGroups,
        setProcuredBy,
        setDepartments,
    } = useOpsAssetFilter();

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
    const [page, setPage] = useState<{ skip: number; limit: number }>({ skip: 0, limit: PAGE_SIZE });
    // Capture "now" at mount so age math is stable across re-renders.
    const [now] = useState<number>(() => Date.now());

    // Base set for this page: dashboard categories AND in-stock.
    const base = useMemo(
        () => rows.filter((r) => isInScopeAsset(r) && isInStock(r)),
        [rows],
    );

    const slicers: SlicerConfig[] = useMemo(() => {
        const categories = groupBy(base, (r) => r.model_category).map((g) => g.key);
        const stockrooms = groupBy(base, (r) => r.stock_room).map((g) => g.key);
        const supportGroups = groupBy(base, supportGroupOf).map((g) => g.key);
        const procured = groupBy(base, procuredByOf).map((g) => g.key);
        const departments = groupBy(base, (r) => r.department ?? 'Unknown').map((g) => g.key);
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
            { type: 'multi', param: 'model_category', label: t('filters.modelCategory'), options: categories },
            {
                type: 'multi',
                param: 'stock_room',
                label: t('filters.stockroom'),
                options: stockrooms,
                clientSide: true,
            },
        ];
    }, [base, t]);

    const filtered = useMemo(() => {
        const catSel = (filters.model_category as string[]) ?? [];
        const stockSel = (filters.stock_room as string[]) ?? [];
        const deviceSel = (filters.device_type as string[]) ?? [];
        const supportSel = assetFilter.supportGroups;
        const procuredSel = assetFilter.procuredBy;
        const deptSel = assetFilter.departments;
        return base.filter((r) => {
            if (catSel.length && (!r.model_category || !catSel.includes(r.model_category))) return false;
            if (stockSel.length && !stockSel.includes(r.stock_room ?? 'Unknown')) return false;
            if (deviceSel.length && !deviceSel.includes(inferDeviceType(r.model_name))) return false;
            if (supportSel.length && !supportSel.includes(supportGroupOf(r))) return false;
            if (procuredSel.length && !procuredSel.includes(procuredByOf(r))) return false;
            if (deptSel.length && !deptSel.includes(r.department ?? 'Unknown')) return false;
            return true;
        });
    }, [base, filters, assetFilter]);

    // Enrich once so both KPIs and the table can consume the same derived fields.
    const enriched: TableRow[] = useMemo(() => {
        return filtered.map((r) => {
            const months = ageMonths(r, now);
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
    }, [filtered, now]);

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
            // Group by physical stock-room name (e.g. "Singapore SKY
            // L6 IT Stockroom"). The donut and the existing
            // stock_room slicer share the same filter dimension.
            groupBy(filtered, (r) => r.stock_room ?? 'Unknown')
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

    // Model-family bar chart — bucket SN model_display_name into
    // coarse families so the chart shows ~10 bars instead of
    // hundreds of SKUs. See `modelFamily` in aggregate.ts for the
    // bucketing rules.
    const modelFamilyBar = useMemo(() => {
        return groupBy(filtered, (r) => modelFamily(r.model_display_name ?? r.model_name))
            .slice(0, 12)
            .map((g) => ({ key: g.key, count: g.count }));
    }, [filtered]);

    // Donut click / legend toggle helpers — both feed the same filter
    // state so slice click and legend click stay in sync.
    const toggleFilter = (param: string, name: string) => {
        const cur = (filters[param] as string[]) ?? [];
        const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];
        setFilters({ ...filters, [param]: next });
        setPage({ skip: 0, limit: PAGE_SIZE });
    };
    // Donut/legend selection state — these read from the same filter
    // params the panel slicers and `filtered` predicate use, so the
    // two stay in sync.
    const selectedStockRooms = (filters.stock_room as string[]) ?? [];
    const selectedCategories = (filters.model_category as string[]) ?? [];
    const selectedDeviceTypes = (filters.device_type as string[]) ?? [];

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
        <div className={`flex flex-col h-[calc(100vh-4rem)] overflow-hidden p-4 gap-3 ${isLight ? 'bg-slate-50' : ''}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                        <PackageCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.inStockTitle')}</h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>{t('pages.inStockSubtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <TranslatedAutoRefresh onRefresh={() => void refetch()} storageKey="ops-dashboard:in-stock-assets:auto-refresh" />
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
                onChange={(next) => {
                    onFilterStateChange(next);
                    setPage({ skip: 0, limit: PAGE_SIZE });
                }}
                storageKey="ops-dashboard:in-stock-assets:filters"
                title={t('filters.title')}
                clearLabel={t('filters.clearAll')}
                clientSideTooltip={t('filters.clientSideTooltip')}
            />

            {/* KPI row — three big-number tiles. */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
                <KpiCard
                    label={t('kpis.inStock')}
                    value={kpis.count}
                    icon={PackageCheck}
                    tooltip={t('kpis.inStockInfo')}
                />
                <KpiCard
                    label={t('pages.totalResidual')}
                    value={kpis.residual}
                    icon={DollarSign}
                    tooltip={t('pages.totalResidual')}
                />
                <KpiCard
                    label={t('pages.avgAge')}
                    value={kpis.avgAge}
                    icon={Calendar}
                    tooltip={t('pages.avgAge')}
                />
            </div>

            {/* Donut row — three interactive donuts on their own line so
                the slices and legends have room to breathe (used to be
                squeezed into a 6-col row with the KPI tiles). */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
                <DonutCard
                    title={t('charts.inStockLocation')}
                    info={t('charts.inStockLocationInfo')}
                    data={locationSlices}
                    palette={DONUT_PALETTE}
                    height={220}
                    onSliceClick={(s) => toggleFilter('stock_room', s.name)}
                    selectedSlices={selectedStockRooms}
                    onLegendToggle={(name) => toggleFilter('stock_room', name)}
                    emptyText={loading ? t('empty.loading') : t('empty.noData')}
                />
                <DonutCard
                    title={t('charts.byCategory')}
                    info={t('charts.byCategoryInfo')}
                    data={categorySlices}
                    palette={DONUT_PALETTE}
                    height={220}
                    onSliceClick={(s) => toggleFilter('model_category', s.name)}
                    selectedSlices={selectedCategories}
                    onLegendToggle={(name) => toggleFilter('model_category', name)}
                    emptyText={loading ? t('empty.loading') : t('empty.noData')}
                />
                <DonutCard
                    title={t('charts.deviceType')}
                    info={t('charts.deviceTypeInfo')}
                    data={deviceTypeSlices}
                    palette={DONUT_PALETTE}
                    height={220}
                    onSliceClick={(s) => toggleFilter('device_type', s.name)}
                    selectedSlices={selectedDeviceTypes}
                    onLegendToggle={(name) => toggleFilter('device_type', name)}
                    emptyText={loading ? t('empty.loading') : t('empty.noData')}
                />
            </div>

            {/* Model-family bar chart — bucketed view of the table
                model dimension so the long tail collapses into ~10
                bars instead of one bar per SKU. */}
            <div className="mb-3 shrink-0">
                <GroupBarCard
                    title={t('charts.byModel')}
                    subtitle={t('charts.byModelSubtitle')}
                    info={t('charts.byModelInfo')}
                    data={modelFamilyBar}
                    topN={12}
                    height={240}
                    color={DONUT_PALETTE}
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
                    csvFilename="in_stock_assets"
                    csvRows={enriched}
                />
            </div>
        </div>
    );
}
