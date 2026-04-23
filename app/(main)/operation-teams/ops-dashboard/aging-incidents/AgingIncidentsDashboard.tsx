'use client';

/**
 * Aging Incidents (Page 1.3.6) — ports `temp_ref/.../dashboard/aging-incidents/AgingIncidentsPage.tsx`.
 *
 * Base filter: incidents, active state, and — the bit
 * that can't be expressed server-side in Phase 1 — days-no-update > 2.
 * Pagination is therefore client-side: we aggregate the filtered array,
 * slice it, and hand the slice to the shared AgingTable.
 */

import { useMemo, useState } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useIncidents } from '@/lib/hooks/useOpsDashboard';
import type { TicketRow } from '@/lib/api/ops_dashboard';
import { daysSinceUpdated, groupBy, isActiveState } from '@/lib/ops_dashboard/aggregate';
import {
    AgingTable,
    type AgingTableRow,
} from '@/components/ops_dashboard/AgingTable';
import {
    SidebarFilters,
    type FilterState,
    type SlicerConfig,
} from '@/components/ops_dashboard/filters/SidebarFilters';

const PAGE_SIZE = 100;

interface Row extends AgingTableRow {
    object_type: 'incident';
    created_at: string;
    updated_at: string;
}

function locationOf(row: TicketRow): string {
    return row.actor?.location?.descriptor?.trim() || '—';
}

function openedByOf(row: TicketRow): string {
    const name = row.actor?.fullname?.trim();
    if (name) return name;
    return row.caller_name?.trim() || '—';
}

function formatShortDate(iso: string): string {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return '—';
    return new Date(t).toLocaleDateString();
}

export function AgingIncidentsDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // Aging view only cares about active tickets by definition. Server-side
    // active filter + page-through avoids the 1000-row silent cutoff.
    const { data, loading, error, refetch } = useIncidents(
        { limit: 1000, is_business_wise_active: true },
        { fetchAll: true },
    );
    const partial = data?.partial === true;

    // Capture "now" at mount so aging math is stable across re-renders.
    const [now] = useState<number>(() => Date.now());

    const [filters, setFilters] = useState<FilterState>({
        assigned_group: [],
        location: [],
    });
    const [page, setPage] = useState<{ skip: number; limit: number }>({ skip: 0, limit: PAGE_SIZE });

    // Base: active + aging > 2d.
    const base: TicketRow[] = useMemo(() => {
        const rows = data?.items ?? [];
        return rows.filter((r) => isActiveState(r.state) && daysSinceUpdated(r, now) > 2);
    }, [data, now]);

    const slicers: SlicerConfig[] = useMemo(() => {
        const groups = groupBy(base, (r) => r.assigned_group).map((g) => g.key);
        const locations = groupBy(base, locationOf).map((g) => g.key);
        return [
            { type: 'multi', param: 'assigned_group', label: t('filters.assignmentGroup'), options: groups },
            { type: 'multi', param: 'location', label: t('filters.location'), options: locations },
        ];
    }, [base, t]);

    const filtered = useMemo(() => {
        const groupSel = (filters.assigned_group as string[]) ?? [];
        const locSel = (filters.location as string[]) ?? [];
        return base.filter((r) => {
            if (groupSel.length && !groupSel.includes(r.assigned_group ?? 'Unknown')) return false;
            if (locSel.length && !locSel.includes(locationOf(r))) return false;
            return true;
        });
    }, [base, filters]);

    const enriched: Row[] = useMemo(
        () =>
            filtered.map((r) => ({
                ...r,
                object_type: 'incident' as const,
                _daysNoUpdate: daysSinceUpdated(r, now),
                _openedBy: openedByOf(r),
                _location: locationOf(r),
                _openedFormatted: formatShortDate(r.created_at),
                _updatedAtMs: Date.parse(r.updated_at) || 0,
            })),
        [filtered, now],
    );

    // Sort by days-no-update desc so the oldest bubble to the top.
    const sorted = useMemo(
        () => [...enriched].sort((a, b) => b._daysNoUpdate - a._daysNoUpdate),
        [enriched],
    );

    const pageRows = useMemo(
        () => sorted.slice(page.skip, page.skip + page.limit),
        [sorted, page],
    );

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';

    return (
        <div className={`flex h-[calc(100vh-4rem)] ${isLight ? 'bg-slate-50' : ''}`}>
            <div className="flex-1 flex flex-col overflow-hidden p-4 min-w-0">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-400'}`}>
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${textMain}`}>{t('pages.agingIncidentsTitle')}</h1>
                            <p className={`text-sm mt-0.5 ${textMuted}`}>
                                {t('pages.agingIncidentsSubtitle')} · {t('pages.agingRecords', { count: sorted.length.toLocaleString() })}
                            </p>
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

                {/* Table */}
                <div className="flex-1 min-h-0">
                    <AgingTable<Row>
                        rows={pageRows}
                        total={sorted.length}
                        skip={page.skip}
                        limit={page.limit}
                        onPageChange={setPage}
                        warnThresholdDays={2}
                        dangerThresholdDays={7}
                        stateBadgeTone="blue"
                        loading={loading}
                        partial={partial}
                        error={error}
                        onRetry={() => void refetch()}
                        pageSize={PAGE_SIZE}
                    />
                </div>
            </div>

            {/* Right sidebar */}
            <div className={`w-60 shrink-0 border-l p-4 overflow-auto ${isLight ? 'bg-white border-slate-200' : 'bg-white/[0.03] border-white/10'}`}>
                <SidebarFilters
                    slicers={slicers}
                    value={filters}
                    onChange={(next) => {
                        setFilters(next);
                        setPage({ skip: 0, limit: PAGE_SIZE });
                    }}
                />
            </div>
        </div>
    );
}
