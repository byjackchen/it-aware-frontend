'use client';

/**
 * Zero Residual Assets — single-table drill-in for assets whose
 * residual value has depreciated to zero (or is unset).
 *
 * Mirrors the structure of PendingAssetsDashboard but with a single
 * tab — same column layout, search, sort, and pagination behaviour
 * for visual consistency. Reached via the chevron-arrow on the Asset
 * Hub's "Zero Residual" KPI tile.
 */

import { useCallback, useMemo, useState } from 'react';
import { DollarSign, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useHardwares } from '@/lib/hooks/useOpsDashboard';
import type { HardwareRow } from '@/lib/api/ops_dashboard';
import { groupBy, inferDeviceType, isInScopeAsset, isZeroResidual } from '@/lib/ops_dashboard/aggregate';
import { countryToRegion, extractCountry, normalizeRegion } from '@/lib/ops_dashboard/region';
import { DataTable, type ColDef } from '@/components/ops_dashboard/DataTable';
import { TopFilterBar, type FilterState, type SlicerConfig } from '@/components/ops_dashboard/filters/TopFilterBar';
import { useOpsAssetFilter } from '@/lib/hooks/useOpsAssetFilter';
import { TranslatedAutoRefresh } from '@/components/ops_dashboard/TranslatedAutoRefresh';

/**
 * Support-group classifier — same region-fallback chain Asset Hub
 * uses so the shared filter speaks a common vocabulary.
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

/** Procured-by classifier — prefer explicit `asset_owner` (OIT / Studio / …). */
function procuredByOf(row: HardwareRow): string {
    return row.asset_owner?.trim() || 'Unknown';
}

const PAGE_SIZE = 100;

interface TableRow extends Record<string, unknown> {
    oid: string;
    serial_number: string;
    model_category: string | null;
    model_name: string | null;
    model_display_name: string | null;
    asset_status: string | null;
    substatus: string | null;
    assigned_to_display_name: string | null;
    department: string | null;
    residual_value: string | number | null;
    cost: string | number | null;
    created_at: string;
    _residualNumber: number;
    _costNumber: number;
    _ageFormatted: string;
    _ageMonths: number;
    _deviceType: string;
    _supportGroup: string;
    _assignedTo: string;
}

function residualAsNumber(v: string | number | null | undefined): number {
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

export function ZeroResidualAssetsDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const { data, loading, error, refetch } = useHardwares(
        { limit: 1000, is_active: true },
        { fetchAll: true },
    );
    const rows: HardwareRow[] = useMemo(() => data?.items ?? [], [data]);
    const partial = data?.partial === true;

    const [page, setPage] = useState<{ skip: number; limit: number }>({ skip: 0, limit: PAGE_SIZE });
    const [now] = useState<number>(() => Date.now());

    // Support Group / Procured By / Department — shared across every
    // asset-oriented dashboard via useOpsAssetFilter.
    const {
        filter: assetFilter,
        setSupportGroups,
        setProcuredBy,
        setDepartments,
    } = useOpsAssetFilter();
    const [filters, setFilters] = useState<FilterState>({});
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

    const base = useMemo(
        () => rows.filter(isInScopeAsset),
        [rows],
    );

    const slicers: SlicerConfig[] = useMemo(() => {
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
        ];
    }, [base, t]);

    const filtered = useMemo(() => {
        const supportSel = assetFilter.supportGroups;
        const procuredSel = assetFilter.procuredBy;
        const deptSel = assetFilter.departments;
        return base.filter((r) => {
            if (!isZeroResidual(r)) return false;
            if (supportSel.length && !supportSel.includes(supportGroupOf(r))) return false;
            if (procuredSel.length && !procuredSel.includes(procuredByOf(r))) return false;
            if (deptSel.length && !deptSel.includes(r.department ?? 'Unknown')) return false;
            return true;
        });
    }, [base, assetFilter]);

    const enriched: TableRow[] = useMemo(() => {
        return filtered.map((r) => {
            const months = ageMonths(r, now);
            const enrichedRow: TableRow = {
                ...r,
                _residualNumber: residualAsNumber(r.residual_value),
                _costNumber: residualAsNumber(r.cost),
                _ageFormatted: formatAge(months),
                _ageMonths: months,
                _deviceType: inferDeviceType(r.model_name),
                _supportGroup: r.department ?? 'Unknown',
                _assignedTo: r.assigned_to_display_name ?? '-',
            };
            return enrichedRow;
        });
    }, [filtered, now]);

    const pageRows = useMemo(
        () => enriched.slice(page.skip, page.skip + page.limit),
        [enriched, page],
    );

    const cols: ColDef<TableRow>[] = useMemo(
        () => [
            { key: 'model_category', label: t('tables.modelCategory'), width: '120px' },
            {
                key: 'model_display_name',
                label: t('tables.model'),
                width: '200px',
                render: (r) => r.model_display_name ?? r.model_name ?? '-',
            },
            {
                key: 'serial_number',
                label: t('tables.serialNumber'),
                width: '180px',
                render: (r) => <span className="font-mono text-xs">{r.serial_number}</span>,
            },
            { key: '_assignedTo', label: t('tables.assignedTo'), width: '160px' },
            { key: '_supportGroup', label: t('tables.supportGroup'), width: '150px' },
            {
                key: 'asset_status',
                label: t('tables.state'),
                width: '110px',
                render: (r) => r.asset_status ?? '-',
            },
            {
                key: 'substatus',
                label: t('tables.substate'),
                width: '160px',
                render: (r) => r.substatus ?? '-',
            },
            { key: '_deviceType', label: t('tables.device'), width: '80px' },
            {
                key: 'cost',
                label: t('tables.cost'),
                width: '110px',
                render: (r) => (r._costNumber > 0 ? `$${r._costNumber.toLocaleString()}` : '-'),
                sortValue: (r) => r._costNumber,
            },
            {
                key: 'residual_value',
                label: t('tables.residualValue'),
                width: '120px',
                render: (r) => `$${r._residualNumber.toLocaleString()}`,
                sortValue: (r) => r._residualNumber,
            },
            { key: '_ageFormatted', label: t('tables.age'), width: '90px', sortValue: (r) => r._ageMonths },
        ],
        [t],
    );

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] p-4 ${isLight ? 'bg-slate-50' : ''}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>
                            {t('pages.zeroResidualTitle')}
                        </h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>
                            {t('pages.zeroResidualSubtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <TranslatedAutoRefresh onRefresh={() => void refetch()} storageKey="ops-dashboard:zero-residual-assets:auto-refresh" />
                    <button
                    onClick={() => void refetch()}
                    className={`p-2 rounded-lg border transition-colors ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
                    title={t('empty.retry')}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
                </div>
            </div>

            {/* Top filter bar — shared Support Group / Procured By / Department. */}
            <TopFilterBar
                slicers={slicers}
                value={filterStateForBar}
                onChange={onFilterStateChange}
                storageKey="ops-dashboard:zero-residual-assets:filters"
                title={t('filters.title')}
                clearLabel={t('filters.clearAll')}
                clientSideTooltip={t('filters.clientSideTooltip')}
            />

            <div className="flex items-center mb-3 shrink-0">
                <span className={`ml-auto text-xs ${textMuted}`}>
                    {t('pages.records', { count: enriched.length.toLocaleString() })}
                </span>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0">
                <DataTable<TableRow>
                    rows={pageRows}
                    cols={cols}
                    searchKeys={['serial_number', 'model_display_name', 'model_name', '_assignedTo', '_supportGroup'] as (keyof TableRow)[]}
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
                    csvFilename="zero_residual_assets"
                    csvRows={enriched}
                />
            </div>
        </div>
    );
}
