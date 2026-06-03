'use client';

/**
 * CollapsibleDetailTable — a `<details>`-based wrapper around DataTable
 * used at the bottom of the Ops Dashboard pages (Active Monitoring Hub,
 * Asset Hub, Catalog, Incidents, In-Stock Assets, On/Offboarding) so a
 * full row-level breakdown is always available without occupying real
 * estate by default.
 *
 * Behaviour
 * ---------
 * - Collapsed by default. Choice persists per-page via localStorage.
 * - When OPEN, the disclosure stretches with `flex-1 min-h-0` so the
 *   embedded DataTable scrolls inside its own region.
 * - When CLOSED, the disclosure shrinks (`shrink-0`) and only takes the
 *   header row's height — the page's other charts are not pushed
 *   around.
 * - Pagination + search + CSV export all come from the wrapped
 *   DataTable. Pass the FULL row set as `csvRows` so Export CSV
 *   downloads everything matching the active filter, not just the
 *   current page.
 */

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { DataTable, type ColDef } from './DataTable';

export interface CollapsibleDetailTableProps<R extends Record<string, unknown>> {
    /** Per-page key — e.g. `ops-dashboard:incidents:detail-open`. */
    storageKey: string;
    /** Header label. */
    title: string;
    /** Right-aligned subtitle (typically "X records"). */
    countLabel?: ReactNode;

    /** Page-of-rows passed to DataTable's `rows` prop. */
    rows: R[];
    /** Full row set for CSV export. */
    csvRows: R[];
    cols: ColDef<R>[];
    searchKeys?: (keyof R)[];

    total: number;
    skip: number;
    limit: number;
    onPageChange: (next: { skip: number; limit: number }) => void;

    loading?: boolean;
    partial?: boolean;
    error?: string | null;
    onRetry?: () => void;

    emptyText?: string;
    loadingText?: string;
    partialText?: string;
    csvFilename?: string;

    /** Default expanded state on first visit. Defaults to false. */
    defaultOpen?: boolean;
}

function readPersisted(storageKey: string, fallback: boolean): boolean {
    if (typeof window === 'undefined') return fallback;
    try {
        const v = window.localStorage.getItem(storageKey);
        if (v === '1') return true;
        if (v === '0') return false;
    } catch {
        /* ignore */
    }
    return fallback;
}

function writePersisted(storageKey: string, open: boolean): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(storageKey, open ? '1' : '0');
    } catch {
        /* ignore */
    }
}

export function CollapsibleDetailTable<R extends Record<string, unknown>>({
    storageKey,
    title,
    countLabel,
    rows,
    csvRows,
    cols,
    searchKeys,
    total,
    skip,
    limit,
    onPageChange,
    loading,
    partial,
    error,
    onRetry,
    emptyText,
    loadingText,
    partialText,
    csvFilename,
    defaultOpen = false,
}: CollapsibleDetailTableProps<R>) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const [open, setOpen] = useState<boolean>(() => readPersisted(storageKey, defaultOpen));

    const cardCls = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5';
    const titleCls = isLight ? 'text-slate-800' : 'text-white';
    const mutedCls = isLight ? 'text-slate-500' : 'text-gray-400';

    return (
        <details
            className={`${open ? 'flex-1 min-h-0 flex flex-col' : 'shrink-0'} rounded-xl border ${cardCls}`}
            open={open}
            onToggle={(e) => {
                const next = (e.currentTarget as HTMLDetailsElement).open;
                setOpen(next);
                writePersisted(storageKey, next);
            }}
        >
            <summary
                className={`list-none cursor-pointer select-none px-4 py-3 flex items-center justify-between shrink-0 ${titleCls}`}
            >
                <span className="flex items-center gap-2 text-sm font-medium">
                    <ChevronDown
                        className={`w-4 h-4 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
                    />
                    {title}
                </span>
                {countLabel !== undefined && (
                    <span className={`text-xs ${mutedCls}`}>{countLabel}</span>
                )}
            </summary>
            {open && (
                <div className="px-4 pb-4 flex-1 min-h-0 overflow-auto">
                    <DataTable<R>
                        rows={rows}
                        cols={cols}
                        searchKeys={searchKeys}
                        total={total}
                        skip={skip}
                        limit={limit}
                        onPageChange={onPageChange}
                        loading={loading}
                        partial={partial}
                        error={error ?? null}
                        onRetry={onRetry}
                        emptyText={emptyText}
                        loadingText={loadingText}
                        partialText={partialText}
                        csvFilename={csvFilename}
                        csvRows={csvRows}
                    />
                </div>
            )}
        </details>
    );
}
