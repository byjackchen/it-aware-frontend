'use client';

/**
 * Catalog Task Dashboard (Page 1.3.7) — ports `temp_ref/.../dashboard/catalog/CatalogDashboardPage.tsx`.
 *
 * Base filter: requests where `classifyRequestType(row) === 'catalog_task'`.
 * That's a Phase 1 client-side heuristic — a server-side `request_type`
 * column lands in Phase 2 and will supersede it. The amber footer in
 * the sidebar explains this to the user so they understand why a few
 * rows may look misclassified.
 *
 * KPIs, donuts, bar chart, and trend line are all derived in-browser
 * from the slim request list (limit=1000) — no aggregation endpoint
 * exists yet.
 */

import { useCallback, useMemo, useState } from 'react';
import { ShoppingCart, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useRequests } from '@/lib/hooks/useOpsDashboard';
import type { TicketRow } from '@/lib/api/ops_dashboard';
import {
    classifyRequestType,
    daysSinceUpdated,
    groupBy,
    isActiveState,
    monthsFromRange,
    trendByMonth,
} from '@/lib/ops_dashboard/aggregate';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { GroupBarCard } from '@/components/ops_dashboard/GroupBarCard';
import { TrendLineCard } from '@/components/ops_dashboard/TrendLineCard';
import { ClassifierCaveatFooter } from '@/components/ops_dashboard/ClassifierCaveatFooter';
import {
    TopFilterBar,
    type FilterState,
    type SlicerConfig,
} from '@/components/ops_dashboard/filters/TopFilterBar';

/** Catalog tasks use the prototype's blue-family palette to distinguish them from incidents. */
const CATALOG_PALETTE = [
    '#0ea5e9',
    '#06b6d4',
    '#0891b2',
    '#0284c7',
    '#1d4ed8',
    '#2563eb',
    '#3b82f6',
    '#0369a1',
];

function locationOf(row: TicketRow): string {
    return row.actor?.location?.descriptor?.trim() || 'Unknown';
}

function departmentOf(row: TicketRow): string {
    return row.actor?.organization?.descriptor?.trim() || 'Unknown';
}

function openedDateStr(row: TicketRow): string {
    return (row.created_at ?? '').slice(0, 10);
}

/** Trim a long department/group label to fit the horizontal bar chart. */
function trimLabel(label: string, max = 22): string {
    return label.length > max ? `${label.slice(0, max)}…` : label;
}

export function CatalogDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // 3-month default seeded into the user-visible filter so the picker
    // reflects what's actually being fetched. Otherwise users see a date
    // gap and mistake it for a server-side cutoff.
    const [defaultFromIso] = useState<string>(
        () => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    );

    // Stable aging clock.
    const [now] = useState<number>(() => Date.now());

    const [filters, setFilters] = useState<FilterState>({
        assigned_group: [],
        department: [],
        location: [],
        created_at_from: { from: defaultFromIso, to: null },
        created_at_to: { from: defaultFromIso, to: null },
    });

    const dateRange = (filters.created_at_from as { from: string | null; to: string | null } | undefined) ?? { from: null, to: null };
    const { data, loading, error, refetch } = useRequests(
        {
            limit: 1000,
            created_at_from: dateRange.from ?? undefined,
            created_at_to: dateRange.to ?? undefined,
        },
        { fetchAll: true },
    );
    const partial = data?.partial === true;

    // Narrow to catalog tasks (Phase 1 heuristic).
    const catalogRows: TicketRow[] = useMemo(() => {
        const rows = data?.items ?? [];
        return rows.filter((r) => classifyRequestType(r) === 'catalog_task');
    }, [data]);

    const slicers: SlicerConfig[] = useMemo(() => {
        const groups = groupBy(catalogRows, (r) => r.assigned_group).map((g) => g.key);
        const departments = groupBy(catalogRows, departmentOf).map((g) => g.key);
        const locations = groupBy(catalogRows, locationOf).map((g) => g.key);
        return [
            { type: 'multi', param: 'assigned_group', label: t('filters.assignmentGroup'), options: groups },
            {
                type: 'multi',
                param: 'department',
                label: t('filters.department'),
                options: departments,
                clientSide: true,
            },
            {
                type: 'multi',
                param: 'location',
                label: t('filters.location'),
                options: locations,
                clientSide: true,
            },
            { type: 'date-range', param: ['created_at_from', 'created_at_to'], label: t('filters.opened') },
        ];
    }, [catalogRows, t]);

    const filtered = useMemo(() => {
        const groupSel = (filters.assigned_group as string[]) ?? [];
        const deptSel = (filters.department as string[]) ?? [];
        const locSel = (filters.location as string[]) ?? [];
        const range = (filters.created_at_from as { from: string | null; to: string | null }) ?? { from: null, to: null };
        return catalogRows.filter((r) => {
            if (groupSel.length && !groupSel.includes(r.assigned_group ?? 'Unknown')) return false;
            if (deptSel.length && !deptSel.includes(departmentOf(r))) return false;
            if (locSel.length && !locSel.includes(locationOf(r))) return false;
            if (range.from || range.to) {
                const opened = openedDateStr(r);
                if (range.from && opened && opened < range.from) return false;
                if (range.to && opened && opened > range.to) return false;
            }
            return true;
        });
    }, [catalogRows, filters]);

    const activeRows = useMemo(() => filtered.filter((r) => isActiveState(r.state)), [filtered]);

    const kpis = useMemo(() => {
        const total = filtered.length;
        const active = activeRows.length;
        const resolved = total - active;
        const resolvedRate = total > 0 ? `${((resolved / total) * 100).toFixed(1)}%` : '—';
        let aging7d = 0;
        let aging30d = 0;
        for (const r of activeRows) {
            const days = daysSinceUpdated(r, now);
            if (days > 7) aging7d += 1;
            if (days > 30) aging30d += 1;
        }
        return { total, active, resolved, resolvedRate, aging7d, aging30d };
    }, [filtered, activeRows, now]);

    const stateDonut = useMemo(
        () => groupBy(filtered, (r) => r.state).map((g) => ({ name: g.key, value: g.count })),
        [filtered],
    );

    const groupDonut = useMemo(() => {
        const ranked = groupBy(activeRows, (r) => r.assigned_group).slice(0, 8);
        return ranked.map((g) => ({ name: g.key, value: g.count }));
    }, [activeRows]);

    const departmentBar = useMemo(() => {
        const ranked = groupBy(activeRows, departmentOf).slice(0, 10);
        return ranked.map((g) => ({ key: trimLabel(g.key), count: g.count }));
    }, [activeRows]);

    const trendMonths = useMemo(
        () => monthsFromRange(dateRange.from, dateRange.to, now),
        [dateRange.from, dateRange.to, now],
    );
    const trend = useMemo(
        () => trendByMonth(filtered, trendMonths, now),
        [filtered, trendMonths, now],
    );

    const onGroupSliceClick = useCallback(
        (slice: { name: string }) => {
            const cur = (filters.assigned_group as string[]) ?? [];
            const next = cur.includes(slice.name)
                ? cur.filter((x) => x !== slice.name)
                : [...cur, slice.name];
            setFilters({ ...filters, assigned_group: next });
        },
        [filters],
    );

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';

    const hasFilters = (Object.entries(filters) as [string, unknown][]).some(([, v]) => {
        if (Array.isArray(v)) return v.length > 0;
        const range = v as { from: string | null; to: string | null } | undefined;
        return !!(range?.from || range?.to);
    });

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] overflow-hidden p-4 gap-3 ${isLight ? 'bg-slate-50' : ''}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-sky-100 text-sky-600' : 'bg-sky-500/20 text-sky-400'}`}>
                        <ShoppingCart className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.catalogTitle')}</h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>{t('pages.catalogSubtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {hasFilters && (
                        <span className="text-xs text-blue-400">
                            {t('pages.filteredCatalog', {
                                filtered: filtered.length.toLocaleString(),
                                total: catalogRows.length.toLocaleString(),
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
                storageKey="ops-dashboard:catalog:filters"
                title={t('filters.title')}
                clearLabel={t('filters.clearAll')}
                clientSideTooltip={t('filters.clientSideTooltip')}
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

                {/* Row 1: KPIs */}
                <div className="grid grid-cols-6 gap-3 mb-3">
                    <KpiCard label={t('kpis.totalCatalogTasks')} value={kpis.total} icon={ShoppingCart} />
                    <KpiCard label={t('kpis.active')} value={kpis.active} />
                    <KpiCard label={t('kpis.resolved')} value={kpis.resolved} />
                    <KpiCard label={t('kpis.resolvedRate')} value={kpis.resolvedRate} />
                    <KpiCard label={t('kpis.agingGt7d')} value={kpis.aging7d} />
                    <KpiCard label={t('kpis.agingGt30d')} value={kpis.aging30d} />
                </div>

                {/* Row 2: Donuts */}
                <div className="grid gap-3 mb-3 grid-cols-2">
                    <DonutCard
                        title={t('charts.byStateAll')}
                        data={stateDonut}
                        palette={CATALOG_PALETTE}
                        height={220}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <DonutCard
                        title={t('charts.activeByGroupCatalog')}
                        subtitle={t('charts.activeByGroupSubtitle')}
                        data={groupDonut}
                        palette={CATALOG_PALETTE}
                        height={220}
                        onSliceClick={onGroupSliceClick}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>

                {/* Row 3: Department bar + trend */}
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '3fr 2fr' }}>
                    <GroupBarCard
                        title={t('charts.byDepartment')}
                        data={departmentBar}
                        topN={10}
                        height={260}
                        color="#0ea5e9"
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <TrendLineCard
                        title={t('charts.volumeTrend')}
                        data={trend}
                        color="#0ea5e9"
                        height={260}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>
            </div>

            {/* Classifier caveat — bottom of page */}
            <ClassifierCaveatFooter />
        </div>
    );
}
