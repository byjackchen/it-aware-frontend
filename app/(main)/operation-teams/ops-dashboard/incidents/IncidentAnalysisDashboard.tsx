'use client';

/**
 * Incident Analysis (Page 1.3.4) — ports `temp_ref/.../dashboard/incidents/IncidentDashboardPage.tsx`
 * to the live API via {@link useIncidents}.
 *
 * Base filter: object_type=incident (the `useIncidents` fetcher already
 * pins that server-side). Sidebar slicers narrow by assignment group,
 * priority, department (actor.organization.descriptor), and opened_at
 * range. Active-only KPIs and charts derive from the fetched rows —
 * Phase 1 has no dedicated aggregation endpoints.
 */

import { useMemo, useState } from 'react';
import { AlertTriangle, RefreshCw, Activity, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useIncidents } from '@/lib/hooks/useOpsDashboard';
import type { TicketRow } from '@/lib/api/ops_dashboard';
import {
    groupBy,
    isActiveState,
    daysSinceUpdated,
    trendByMonth,
} from '@/lib/ops_dashboard/aggregate';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { GroupBarCard } from '@/components/ops_dashboard/GroupBarCard';
import { TrendLineCard } from '@/components/ops_dashboard/TrendLineCard';
import {
    TopFilterBar,
    type FilterState,
    type SlicerConfig,
} from '@/components/ops_dashboard/filters/TopFilterBar';

/**
 * Priority palette keyed by the prototype's ServiceNow labels
 * (e.g. "1 - Critical"). Rows whose priority label starts with the
 * same digit fall back to the matching colour in the bucket helpers
 * below so short-form "P1"/"1" data still renders correctly.
 */
const PRIORITY_COLORS: Record<string, string> = {
    '1 - Critical': '#ef4444',
    '2 - High': '#f97316',
    '3 - Moderate': '#eab308',
    '4 - Low': '#22c55e',
    '5 - Planning': '#6366f1',
};

const PRIORITY_DIGIT_COLORS: Record<string, string> = {
    '1': '#ef4444',
    '2': '#f97316',
    '3': '#eab308',
    '4': '#22c55e',
    '5': '#6366f1',
};

const STATE_PALETTE = [
    '#3b82f6',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
    '#94a3b8',
];

/** Normalise priority labels to "1" … "5" so "P1", "1 - Critical", "1" all line up. */
function priorityDigit(p: string | null | undefined): string | null {
    if (!p) return null;
    const match = p.match(/(\d)/);
    return match ? match[1] : null;
}

function priorityColor(label: string): string {
    const direct = PRIORITY_COLORS[label];
    if (direct) return direct;
    const digit = priorityDigit(label);
    return (digit && PRIORITY_DIGIT_COLORS[digit]) || '#94a3b8';
}

function departmentOf(row: TicketRow): string {
    return row.actor?.organization?.descriptor?.trim() || 'Unknown';
}

function openedDateStr(row: TicketRow): string {
    return (row.created_at ?? '').slice(0, 10);
}

export function IncidentAnalysisDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // 3-month default horizon on page load + page-through to avoid the
    // 1000-row silent cutoff. created_at_from pins the window so server
    // payload stays bounded.
    const [threeMonthsAgoIso] = useState<string>(
        () => new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    );
    const { data, loading, error, refetch } = useIncidents(
        { limit: 1000, created_at_from: threeMonthsAgoIso },
        { fetchAll: true },
    );
    const rows: TicketRow[] = useMemo(() => data?.items ?? [], [data]);
    const partial = data?.partial === true;

    // Capture "now" at mount so aging math is stable across re-renders
    // (react-hooks/purity rejects Date.now() inside useMemo).
    const [now] = useState<number>(() => Date.now());

    const [filters, setFilters] = useState<FilterState>({
        assigned_group: [],
        priority: [],
        department: [],
        created_at_from: { from: null, to: null },
        created_at_to: { from: null, to: null },
    });

    const slicers: SlicerConfig[] = useMemo(() => {
        const groups = groupBy(rows, (r) => r.assigned_group).map((g) => g.key);
        const priorities = groupBy(rows, (r) => r.priority)
            .map((g) => g.key)
            .sort();
        const departments = groupBy(rows, departmentOf).map((g) => g.key);
        return [
            { type: 'multi', param: 'assigned_group', label: t('filters.assignmentGroup'), options: groups },
            { type: 'multi', param: 'priority', label: t('filters.priority'), options: priorities },
            {
                type: 'multi',
                param: 'department',
                label: t('filters.department'),
                options: departments,
                clientSide: true,
            },
            { type: 'date-range', param: ['created_at_from', 'created_at_to'], label: t('filters.opened') },
        ];
    }, [rows, t]);

    const filtered = useMemo(() => {
        const groupSel = (filters.assigned_group as string[]) ?? [];
        const prioSel = (filters.priority as string[]) ?? [];
        const deptSel = (filters.department as string[]) ?? [];
        const range = (filters.created_at_from as { from: string | null; to: string | null }) ?? { from: null, to: null };
        return rows.filter((r) => {
            if (groupSel.length && !groupSel.includes(r.assigned_group ?? 'Unknown')) return false;
            if (prioSel.length && !prioSel.includes(r.priority)) return false;
            if (deptSel.length && !deptSel.includes(departmentOf(r))) return false;
            if (range.from || range.to) {
                const opened = openedDateStr(r);
                if (range.from && opened && opened < range.from) return false;
                if (range.to && opened && opened > range.to) return false;
            }
            return true;
        });
    }, [rows, filters]);

    const activeRows = useMemo(() => filtered.filter((r) => isActiveState(r.state)), [filtered]);

    const kpis = useMemo(() => {
        const total = filtered.length;
        const active = activeRows.length;
        let p1 = 0;
        let p2 = 0;
        let aging2d = 0;
        let aging7d = 0;
        let vipActive = 0;
        for (const r of activeRows) {
            const digit = priorityDigit(r.priority);
            if (digit === '1') p1 += 1;
            if (digit === '2') p2 += 1;
            const days = daysSinceUpdated(r, now);
            if (days > 2) aging2d += 1;
            if (days > 7) aging7d += 1;
            const vip =
                (r as unknown as { is_vip?: boolean }).is_vip === true ||
                (r.actor as unknown as { is_vip?: boolean } | null)?.is_vip === true;
            if (vip) vipActive += 1;
        }
        const resolvedRate = total > 0 ? `${(((total - active) / total) * 100).toFixed(1)}%` : '—';
        return { total, active, p1, p2, aging2d, aging7d, vipActive, resolvedRate };
    }, [filtered, activeRows, now]);

    const priorityDonut = useMemo(() => {
        const slices = groupBy(activeRows, (r) => r.priority).map((g) => ({
            name: g.key,
            value: g.count,
            color: priorityColor(g.key),
        }));
        return slices;
    }, [activeRows]);

    const stateDonut = useMemo(
        () => groupBy(filtered, (r) => r.state).map((g) => ({ name: g.key, value: g.count })),
        [filtered],
    );

    const groupBar = useMemo(() => groupBy(activeRows, (r) => r.assigned_group), [activeRows]);

    const trend = useMemo(() => trendByMonth(filtered, 10, now), [filtered, now]);

    const onPrioritySliceClick = (slice: { name: string }) => {
        const cur = (filters.priority as string[]) ?? [];
        const next = cur.includes(slice.name) ? cur.filter((x) => x !== slice.name) : [...cur, slice.name];
        setFilters({ ...filters, priority: next });
    };

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
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400'}`}>
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.incidentsTitle')}</h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>{t('pages.incidentsSubtitle')}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {hasFilters && (
                        <span className="text-xs text-blue-400">
                            {t('pages.filteredIncidents', {
                                filtered: filtered.length.toLocaleString(),
                                total: rows.length.toLocaleString(),
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
                storageKey="ops-dashboard:incidents:filters"
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

                {/* KPI row */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                    <KpiCard label={t('kpis.totalIncidents')} value={kpis.total} icon={AlertTriangle} />
                    <KpiCard label={t('kpis.active')} value={kpis.active} icon={Activity} />
                    <KpiCard label={t('kpis.p1')} value={kpis.p1} />
                    <KpiCard label={t('kpis.p2')} value={kpis.p2} />
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                    <KpiCard label={t('kpis.agingGt2d')} value={kpis.aging2d} />
                    <KpiCard label={t('kpis.agingGt7d')} value={kpis.aging7d} />
                    <KpiCard label={t('kpis.vipActive')} value={kpis.vipActive} icon={Star} />
                    <KpiCard label={t('kpis.resolvedRate')} value={kpis.resolvedRate} />
                </div>

                {/* Donut row */}
                <div className="grid gap-3 mb-3 grid-cols-2">
                    <DonutCard
                        title={t('charts.activeByPriority')}
                        subtitle={t('charts.activeByPrioritySubtitle')}
                        data={priorityDonut}
                        height={220}
                        onSliceClick={onPrioritySliceClick}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <DonutCard
                        title={t('charts.byStateAll')}
                        data={stateDonut}
                        palette={STATE_PALETTE}
                        height={220}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>

                {/* Bar + trend row */}
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '3fr 2fr' }}>
                    <GroupBarCard
                        title={t('charts.activeByGroup')}
                        data={groupBar}
                        topN={10}
                        height={260}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <TrendLineCard
                        title={t('charts.monthlyOpenedTrend')}
                        data={trend}
                        color="#ef4444"
                        height={260}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>
            </div>
        </div>
    );
}
