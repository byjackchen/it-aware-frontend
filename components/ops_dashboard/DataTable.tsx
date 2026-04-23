'use client';

/**
 * Server-side-paginated DataTable for the Ops Dashboard.
 *
 * Port of `temp_ref/Ohla/Frontend/components/dashboard/DataTable.tsx` with
 * the pagination converted from client-side (slice the full dataset) to
 * server-side (the caller holds the current page's rows + `total` and
 * wires `onPageChange` back into its list fetcher).
 *
 * Search and sort remain client-side over the current page for Phase 1 —
 * server-side sort is a separate concern we'll address in Phase 2.
 */

import { useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

export interface ColDef<T> {
    key: keyof T | string;
    label: string;
    width?: string;
    render?: (row: T) => React.ReactNode;
    sortValue?: (row: T) => string | number;
}

export interface DataTableProps<T extends Record<string, unknown>> {
    /** Current page of rows (server-paginated). */
    rows: T[];
    cols: ColDef<T>[];
    /** Keys used for the client-side search box over the current page. */
    searchKeys?: (keyof T)[];
    /** Total row count on the server; used to drive the pagination UI. */
    total: number | null;
    /** Current skip offset. */
    skip: number;
    /** Current page size. */
    limit: number;
    /** Called when the user changes page or page size. */
    onPageChange: (next: { skip: number; limit: number }) => void;
    /** Optional page-size options; defaults to [25, 50, 100, 200]. */
    pageSizeOptions?: number[];
    /** Loading state banner above the table. */
    loading?: boolean;
    /** "Partial response" banner — rendered when the slim endpoint timed out. */
    partial?: boolean;
    /** Optional error banner. */
    error?: string | null;
    /** Shown when the partial/error banner has a retry callback. */
    onRetry?: () => void;
    /** Copy for empty / loading / partial states. */
    emptyText?: string;
    loadingText?: string;
    partialText?: string;
}

type SortDir = 'asc' | 'desc' | null;

const DEFAULT_PAGE_SIZES = [25, 50, 100, 200];

export function DataTable<T extends Record<string, unknown>>({
    rows,
    cols,
    searchKeys,
    total,
    skip,
    limit,
    onPageChange,
    pageSizeOptions = DEFAULT_PAGE_SIZES,
    loading = false,
    partial = false,
    error = null,
    onRetry,
    emptyText = 'No records found',
    loadingText = 'Loading...',
    partialText = 'Still loading — the server is taking longer than expected. Please retry.',
}: DataTableProps<T>) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDir, setSortDir] = useState<SortDir>(null);
    const [search, setSearch] = useState('');

    const searched = useMemo(() => {
        if (!search.trim() || !searchKeys?.length) return rows;
        const q = search.toLowerCase();
        return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(q)));
    }, [rows, search, searchKeys]);

    const sorted = useMemo(() => {
        if (!sortKey || !sortDir) return searched;
        const col = cols.find((c) => c.key === sortKey);
        return [...searched].sort((a, b) => {
            const av = col?.sortValue ? col.sortValue(a) : String(a[sortKey as keyof T] ?? '');
            const bv = col?.sortValue ? col.sortValue(b) : String(b[sortKey as keyof T] ?? '');
            if (av < bv) return sortDir === 'asc' ? -1 : 1;
            if (av > bv) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    }, [searched, sortKey, sortDir, cols]);

    const currentPage = Math.floor(skip / Math.max(limit, 1));
    const effectiveTotal = total ?? rows.length + skip;
    const totalPages = Math.max(1, Math.ceil(effectiveTotal / Math.max(limit, 1)));

    function toggleSort(key: string) {
        if (sortKey !== key) {
            setSortKey(key);
            setSortDir('asc');
            return;
        }
        if (sortDir === 'asc') {
            setSortDir('desc');
            return;
        }
        setSortKey(null);
        setSortDir(null);
    }

    function goToPage(nextPage: number) {
        const clamped = Math.max(0, Math.min(nextPage, totalPages - 1));
        onPageChange({ skip: clamped * limit, limit });
    }

    function changePageSize(nextLimit: number) {
        // Snap back to page 0 so skip stays aligned with the new window.
        onPageChange({ skip: 0, limit: nextLimit });
    }

    const th = isLight
        ? 'bg-slate-50 text-slate-600 border-slate-200'
        : 'bg-white/5 text-gray-400 border-white/10';
    const tdBase = isLight ? 'text-slate-700 border-slate-100' : 'text-gray-300 border-white/5';
    const trHover = isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5';
    const inputCls = isLight
        ? 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
        : 'bg-white/5 border-white/10 text-white placeholder-gray-500';
    const mutedText = isLight ? 'text-slate-500' : 'text-gray-400';

    return (
        <div className="flex flex-col h-full">
            {/* Search + count */}
            <div className="flex flex-wrap items-center gap-3 mb-3 shrink-0">
                {searchKeys?.length ? (
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                            className={`pl-8 pr-3 py-1.5 text-xs rounded-lg border w-56 ${inputCls}`}
                            placeholder="Search current page..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                ) : null}
                <span className={`text-xs ${mutedText}`}>
                    {typeof total === 'number' ? (
                        <>{total.toLocaleString()} records</>
                    ) : (
                        <>{rows.length.toLocaleString()} loaded</>
                    )}
                    {search && ` (filtered on page)`}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    <label className={`text-xs ${mutedText}`} htmlFor="page-size">
                        Rows
                    </label>
                    <select
                        id="page-size"
                        className={`text-xs rounded-lg border px-2 py-1 ${inputCls}`}
                        value={limit}
                        onChange={(e) => changePageSize(Number(e.target.value))}
                    >
                        {pageSizeOptions.map((opt) => (
                            <option key={opt} value={opt}>
                                {opt}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Loading / partial / error banners */}
            {loading && !partial && (
                <div
                    className={`rounded-xl border p-3 mb-3 text-xs ${isLight ? 'border-slate-200 bg-white text-slate-500' : 'border-white/10 bg-white/5 text-gray-400'}`}
                >
                    {loadingText}
                </div>
            )}
            {partial && (
                <div
                    className={`rounded-xl border p-3 mb-3 text-xs flex items-center gap-2 ${isLight ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}
                >
                    <span>{partialText}</span>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${isLight ? 'bg-amber-100 hover:bg-amber-200 text-amber-800' : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200'}`}
                        >
                            Retry
                        </button>
                    )}
                </div>
            )}
            {error && !partial && (
                <div
                    className={`rounded-xl border p-3 mb-3 text-xs flex items-center gap-2 ${isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}
                >
                    <span>{error}</span>
                    {onRetry && (
                        <button
                            onClick={onRetry}
                            className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${isLight ? 'bg-red-100 hover:bg-red-200 text-red-800' : 'bg-red-500/20 hover:bg-red-500/30 text-red-200'}`}
                        >
                            Retry
                        </button>
                    )}
                </div>
            )}

            {/* Table */}
            <div
                className="flex-1 overflow-auto rounded-xl border"
                style={{ borderColor: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }}
            >
                <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 z-10">
                        <tr>
                            {cols.map((col) => (
                                <th
                                    key={String(col.key)}
                                    className={`px-3 py-2.5 text-left font-semibold border-b cursor-pointer select-none whitespace-nowrap ${th}`}
                                    style={{ width: col.width }}
                                    onClick={() => toggleSort(String(col.key))}
                                >
                                    <span className="flex items-center gap-1">
                                        {col.label}
                                        {sortKey === col.key ? (
                                            sortDir === 'asc' ? (
                                                <ChevronUp className="w-3 h-3 text-blue-400" />
                                            ) : (
                                                <ChevronDown className="w-3 h-3 text-blue-400" />
                                            )
                                        ) : (
                                            <ChevronsUpDown className="w-3 h-3 opacity-30" />
                                        )}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((row, i) => (
                            <tr
                                key={i}
                                className={`border-b transition-colors ${trHover}`}
                                style={{ borderColor: isLight ? '#f1f5f9' : 'rgba(255,255,255,0.05)' }}
                            >
                                {cols.map((col) => (
                                    <td key={String(col.key)} className={`px-3 py-2 ${tdBase}`}>
                                        {col.render ? col.render(row) : String(row[col.key as keyof T] ?? '')}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        {sorted.length === 0 && (
                            <tr>
                                <td
                                    colSpan={cols.length}
                                    className={`px-3 py-8 text-center ${isLight ? 'text-slate-400' : 'text-gray-500'}`}
                                >
                                    {loading ? loadingText : emptyText}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div
                    className={`flex items-center justify-between pt-2 shrink-0 text-xs ${mutedText}`}
                >
                    <span>
                        Page {currentPage + 1} of {totalPages}
                    </span>
                    <div className="flex gap-1">
                        {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                            const p =
                                totalPages <= 7
                                    ? i
                                    : i === 0
                                        ? 0
                                        : i === 6
                                            ? totalPages - 1
                                            : currentPage - 2 + i;
                            const clamped = Math.max(0, Math.min(p, totalPages - 1));
                            return (
                                <button
                                    key={i}
                                    onClick={() => goToPage(clamped)}
                                    className={`px-2 py-0.5 rounded ${currentPage === clamped ? 'bg-blue-500 text-white' : isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                                >
                                    {clamped + 1}
                                </button>
                            );
                        })}
                    </div>
                    <span>
                        {typeof total === 'number'
                            ? `${Math.min(skip + rows.length, total)} / ${total}`
                            : `${skip + rows.length} loaded`}
                    </span>
                </div>
            )}
        </div>
    );
}
