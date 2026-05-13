'use client';

/**
 * Pending Assets (Page 1.3.3) — 3-tab page (Unconfirmed / Pending Return /
 * Pending Repair). Ports `temp_ref/.../pending-assets/PendingAssetsPage.tsx`.
 *
 * Data strategy: fetch the wide active-asset list once and filter
 * client-side with the `aggregate.ts` predicates. The real substatus
 * values are mixed-case ("Pending Return to Stock" / "Unconfirmed by
 * Worker" / etc.) so the predicates do substring matching — we keep the
 * same posture on the client to avoid sending mismatched multi-value
 * query params.
 */

import { useCallback, useMemo, useState } from 'react';
import { PackageOpen, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useHardwares } from '@/lib/hooks/useOpsDashboard';
import type { HardwareRow } from '@/lib/api/ops_dashboard';
import {
    groupBy,
    inferDeviceType,
    isInScopeAsset,
    isPendingRepair,
    isPendingReturn,
    isUnconfirmed,
} from '@/lib/ops_dashboard/aggregate';
import { countryToRegion, extractCountry, normalizeRegion } from '@/lib/ops_dashboard/region';
import { DataTable, type ColDef } from '@/components/ops_dashboard/DataTable';
import { TopFilterBar, type FilterState, type SlicerConfig } from '@/components/ops_dashboard/filters/TopFilterBar';
import { useOpsAssetFilter } from '@/lib/hooks/useOpsAssetFilter';
import { TranslatedAutoRefresh } from '@/components/ops_dashboard/TranslatedAutoRefresh';

const PAGE_SIZE = 100;

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
function procuredByOf(row: HardwareRow): string {
    return row.asset_owner?.trim() || 'Unknown';
}

type Tab = 'unconfirmed' | 'pending_return' | 'pending_repair';

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
    created_at: string;
    _residualNumber: number;
    _ageFormatted: string;
    _ageMonths: number;
    _deviceType: string;
    _supportGroup: string;
    _assignedTo: string;
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

function tabPredicate(tab: Tab): (row: HardwareRow) => boolean {
    if (tab === 'unconfirmed') return isUnconfirmed;
    if (tab === 'pending_return') return isPendingReturn;
    return isPendingRepair;
}

export function PendingAssetsDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const { data, loading, error, refetch } = useHardwares(
        { limit: 1000, is_active: true },
        { fetchAll: true },
    );
    const rows: HardwareRow[] = useMemo(() => data?.items ?? [], [data]);
    const partial = data?.partial === true;

    const [tab, setTab] = useState<Tab>('unconfirmed');
    const [page, setPage] = useState<{ skip: number; limit: number }>({ skip: 0, limit: PAGE_SIZE });
    // Capture "now" at mount so age math is stable across re-renders.
    const [now] = useState<number>(() => Date.now());

    const base = useMemo(
        () => rows.filter(isInScopeAsset),
        [rows],
    );

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
            setPage({ skip: 0, limit: PAGE_SIZE });
        },
        [assetFilter, setSupportGroups, setProcuredBy, setDepartments],
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

    // Shared-filter narrowed set — used by tab counts and the table
    // alike so switching Support Group narrows both the badges and
    // the rows below in lockstep.
    const scoped = useMemo(() => {
        const supportSel = assetFilter.supportGroups;
        const procuredSel = assetFilter.procuredBy;
        const deptSel = assetFilter.departments;
        return base.filter((r) => {
            if (supportSel.length && !supportSel.includes(supportGroupOf(r))) return false;
            if (procuredSel.length && !procuredSel.includes(procuredByOf(r))) return false;
            if (deptSel.length && !deptSel.includes(r.department ?? 'Unknown')) return false;
            return true;
        });
    }, [base, assetFilter]);

    const tabCounts = useMemo(
        () => ({
            unconfirmed: scoped.filter(isUnconfirmed).length,
            pending_return: scoped.filter(isPendingReturn).length,
            pending_repair: scoped.filter(isPendingRepair).length,
        }),
        [scoped],
    );

    const filtered = useMemo(() => scoped.filter(tabPredicate(tab)), [scoped, tab]);

    const enriched: TableRow[] = useMemo(() => {
        return filtered.map((r) => {
            const months = ageMonths(r, now);
            const enrichedRow: TableRow = {
                ...r,
                _residualNumber: residualAsNumber(r.residual_value),
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

    const tabs: { id: Tab; label: string; count: number }[] = useMemo(
        () => [
            { id: 'unconfirmed', label: t('tabs.unconfirmed'), count: tabCounts.unconfirmed },
            { id: 'pending_return', label: t('tabs.pendingReturn'), count: tabCounts.pending_return },
            { id: 'pending_repair', label: t('tabs.pendingRepair'), count: tabCounts.pending_repair },
        ],
        [t, tabCounts],
    );

    const substateBadgeCls = useMemo<string>(() => {
        if (tab === 'unconfirmed') return isLight ? 'bg-yellow-50 text-yellow-700' : 'bg-yellow-500/15 text-yellow-300';
        if (tab === 'pending_return') return isLight ? 'bg-orange-50 text-orange-700' : 'bg-orange-500/15 text-orange-300';
        return isLight ? 'bg-red-50 text-red-700' : 'bg-red-500/15 text-red-300';
    }, [tab, isLight]);

    const cols: ColDef<TableRow>[] = useMemo(() => [
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
        { key: 'asset_status', label: t('tables.state'), width: '100px', render: (r) => r.asset_status ?? '-' },
        {
            key: 'substatus',
            label: t('tables.substate'),
            width: '160px',
            render: (r) => (
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${substateBadgeCls}`}>
                    {r.substatus ?? '-'}
                </span>
            ),
        },
        { key: '_deviceType', label: t('tables.device'), width: '80px' },
        {
            key: 'residual_value',
            label: t('tables.residualValue'),
            width: '110px',
            render: (r) => (r._residualNumber > 0 ? `$${r._residualNumber.toLocaleString()}` : '-'),
            sortValue: (r) => r._residualNumber,
        },
        { key: '_ageFormatted', label: t('tables.age'), width: '90px', sortValue: (r) => r._ageMonths },
    ], [t, substateBadgeCls]);

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] p-4 ${isLight ? 'bg-slate-50' : ''}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                        <PackageOpen className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.pendingTitle')}</h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>{t('pages.pendingSubtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <TranslatedAutoRefresh onRefresh={() => void refetch()} storageKey="ops-dashboard:pending-assets:auto-refresh" />
                    <button
                    onClick={() => void refetch()}
                    className={`p-2 rounded-lg border transition-colors ${isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'}`}
                    title={t('empty.retry')}
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
                </div>
            </div>

            {/* Shared asset filter bar */}
            <TopFilterBar
                slicers={slicers}
                value={filterStateForBar}
                onChange={onFilterStateChange}
                storageKey="ops-dashboard:pending-assets:filters"
                title={t('filters.title')}
                clearLabel={t('filters.clearAll')}
                clientSideTooltip={t('filters.clientSideTooltip')}
            />

            {/* Tabs */}
            <div className="flex items-center gap-3 mb-3 shrink-0">
                <div className={`flex rounded-lg border overflow-hidden ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                    {tabs.map((item) => {
                        const active = tab === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setTab(item.id);
                                    setPage({ skip: 0, limit: PAGE_SIZE });
                                }}
                                className={`px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors ${
                                    active
                                        ? 'bg-blue-500 text-white'
                                        : isLight
                                            ? 'bg-white text-slate-600 hover:bg-slate-50'
                                            : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                }`}
                            >
                                {item.label}
                                <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                                    active ? 'bg-white/20 text-white' : isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-400'
                                }`}>
                                    {item.count.toLocaleString()}
                                </span>
                            </button>
                        );
                    })}
                </div>
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
                    csvFilename="pending_assets"
                    csvRows={enriched}
                />
            </div>
        </div>
    );
}
