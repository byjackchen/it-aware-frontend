'use client';

/**
 * AgingTable — shared table shell for the three Phase 1 aging pages
 * (Aging Incidents 1.3.6, Aging SC Tasks 1.3.8, Aging Asset Tasks 1.3.9).
 *
 * These pages all render the same basic table shape over `TicketRow`s
 * that have been enriched with aging math + actor breakouts; the only
 * meaningful differences are:
 *   - warn / danger day thresholds (2/7 for incidents; 30/60 for tasks),
 *   - whether the State cell renders as a blue, cyan, or purple badge.
 *
 * Pagination is client-side because the three pages all pre-filter by a
 * `days_no_update > X` predicate that has no server-side equivalent in
 * Phase 1 — the DataTable gets the full filtered array and the caller
 * holds the skip/limit state.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { DataTable, type ColDef } from '@/components/ops_dashboard/DataTable';

export type StateBadgeTone = 'blue' | 'cyan' | 'purple';

export interface AgingTableRow extends Record<string, unknown> {
    oid: string;
    stable_id: string;
    state: string;
    priority: string;
    assigned_group: string | null;
    assigned_to_name: string | null;
    title: string;
    _daysNoUpdate: number;
    _openedBy: string;
    _location: string;
    _openedFormatted: string;
    _updatedAtMs: number;
}

export interface AgingTableProps<T extends AgingTableRow> {
    rows: T[];
    total: number;
    skip: number;
    limit: number;
    onPageChange: (next: { skip: number; limit: number }) => void;
    /** Days threshold above which the aging cell turns orange (warn). */
    warnThresholdDays?: number;
    /** Days threshold above which the aging cell turns red (danger). */
    dangerThresholdDays?: number;
    /** State-badge tone. Defaults to blue (incidents). Cyan = SC tasks; purple = asset tasks. */
    stateBadgeTone?: StateBadgeTone;
    /** Optional: override which columns to include (default = all 10). */
    includePriority?: boolean;
    loading?: boolean;
    partial?: boolean;
    error?: string | null;
    onRetry?: () => void;
    /** Defaults to 100 per the Phase 1 spec. */
    pageSize?: number;
}

function stateBadgeCls(tone: StateBadgeTone, isLight: boolean): string {
    switch (tone) {
        case 'cyan':
            return isLight ? 'bg-cyan-50 text-cyan-700' : 'bg-cyan-500/15 text-cyan-300';
        case 'purple':
            return isLight ? 'bg-purple-50 text-purple-700' : 'bg-purple-500/15 text-purple-300';
        case 'blue':
        default:
            return isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-500/15 text-blue-300';
    }
}

/**
 * Build the aging-cell class. Uses background-highlighted Tailwind
 * variants (not just coloured text) so the cell reads as a chip in
 * tables that have a lot of plain text around it.
 */
function agingCellCls(days: number, warn: number, danger: number): string {
    if (days > danger) {
        return 'inline-block px-2 py-0.5 rounded font-bold bg-red-500/20 text-red-800 dark:bg-red-500/30 dark:text-red-200';
    }
    if (days > warn) {
        return 'inline-block px-2 py-0.5 rounded font-semibold bg-orange-500/20 text-orange-800 dark:bg-orange-500/30 dark:text-orange-200';
    }
    return '';
}

export function AgingTable<T extends AgingTableRow>({
    rows,
    total,
    skip,
    limit,
    onPageChange,
    warnThresholdDays = 2,
    dangerThresholdDays = 7,
    stateBadgeTone = 'blue',
    includePriority = true,
    loading = false,
    partial = false,
    error = null,
    onRetry,
    pageSize: _pageSize,
}: AgingTableProps<T>) {
    // pageSize is retained in the type for symmetry with the page specs
    // but DataTable reads limit directly; keep the prop for clarity.
    void _pageSize;
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const badgeCls = stateBadgeCls(stateBadgeTone, isLight);

    const cols: ColDef<T>[] = useMemo(() => {
        const base: ColDef<T>[] = [
            {
                key: 'stable_id',
                label: t('tables.number'),
                width: '130px',
                render: (r) => <span className="font-mono text-blue-400">{r.stable_id}</span>,
            },
            {
                key: '_daysNoUpdate',
                label: t('tables.daysNoUpdate'),
                width: '120px',
                render: (r) => {
                    const cls = agingCellCls(r._daysNoUpdate, warnThresholdDays, dangerThresholdDays);
                    return <span className={cls}>{r._daysNoUpdate}d</span>;
                },
                sortValue: (r) => r._daysNoUpdate,
            },
            {
                key: 'state',
                label: t('tables.state'),
                width: '140px',
                render: (r) => (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${badgeCls}`}>
                        {r.state}
                    </span>
                ),
            },
        ];
        if (includePriority) {
            base.push({ key: 'priority', label: t('tables.priority'), width: '100px' });
        }
        base.push(
            {
                key: 'assigned_group',
                label: t('tables.assignmentGroup'),
                width: '160px',
                render: (r) => r.assigned_group ?? '—',
            },
            {
                key: 'assigned_to_name',
                label: t('tables.assignedTo'),
                width: '150px',
                render: (r) => r.assigned_to_name ?? '—',
            },
            { key: '_openedBy', label: t('tables.openedBy'), width: '150px' },
            { key: '_location', label: t('tables.location'), width: '140px' },
            {
                key: '_openedFormatted',
                label: t('tables.openedAt'),
                width: '110px',
                sortValue: (r) => Date.parse(String((r as unknown as { created_at: string }).created_at)) || 0,
            },
            { key: 'title', label: t('tables.shortDescription') },
        );
        return base;
    }, [t, badgeCls, includePriority, warnThresholdDays, dangerThresholdDays]);

    return (
        <DataTable<T>
            rows={rows}
            cols={cols}
            searchKeys={['stable_id', 'title', 'assigned_to_name', '_openedBy'] as (keyof T)[]}
            total={total}
            skip={skip}
            limit={limit}
            onPageChange={onPageChange}
            loading={loading}
            partial={partial}
            error={error}
            onRetry={onRetry}
            emptyText={t('empty.noData')}
            loadingText={t('empty.loading')}
            partialText={t('empty.partialResult')}
            pageSizeOptions={[50, 100, 200, 500]}
        />
    );
}
