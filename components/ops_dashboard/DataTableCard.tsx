'use client';

/**
 * DataTableCard — titled card wrapping a scrollable HTML table.
 *
 * Used by Ohla Agent Support / Survey Details / Other Case / Raw Data
 * pages for the PBIX-parity "Details" tables. Caps at `maxRows` to
 * avoid rendering 40K DOM rows; real pagination can come later.
 *
 * Click any column header to toggle ascending → descending → off
 * sorting. Column-specific ordering uses ``Column.sortValue`` when
 * provided (e.g. parse a date string back to ms); otherwise falls
 * back to the cell's stringified default value.
 */

import { useTheme } from '@/lib/contexts/theme-context'
import { useMemo, useState, type ReactNode } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { TitleWithInfo } from './TitleWithInfo'

export interface Column<T> {
    key: string
    label: string
    /** Optional cell renderer. Defaults to `String(row[key])` with '—' for null/undefined. */
    render?: (row: T) => ReactNode
    /** Optional column width in Tailwind (e.g. 'w-20'). */
    width?: string
    /** Align right for numeric columns. */
    alignRight?: boolean
    /**
     * Custom sort key extractor. When provided, the column's sort
     * uses this value (number or string). Without it the column
     * sorts by the cell's stringified default value, which works for
     * most plain-text columns but stumbles on numbers stored as
     * strings or dates rendered as `slice(0,10)` substrings.
     */
    sortValue?: (row: T) => string | number | null | undefined
    /** Set false to make this column non-sortable (header click is a no-op). */
    sortable?: boolean
}

export interface DataTableCardProps<T> {
    title: string
    subtitle?: string
    /** Optional definition / formula shown on hover as a tooltip next to the title. */
    info?: string
    rows: T[]
    columns: Column<T>[]
    maxRows?: number
    emptyText?: string
    /** Total row-count shown in the subtitle if provided (useful when rows is sliced). */
    totalCount?: number
}

type SortDir = 'asc' | 'desc' | null

function defaultCell<T>(row: T, key: string): ReactNode {
    const v = (row as unknown as Record<string, unknown>)[key]
    if (v === null || v === undefined || v === '') return '—'
    return String(v)
}

function defaultSortValue<T>(row: T, key: string): string | number {
    const v = (row as unknown as Record<string, unknown>)[key]
    if (v === null || v === undefined) return ''
    if (typeof v === 'number' || typeof v === 'string') return v
    return String(v)
}

export function DataTableCard<T>({
    title,
    subtitle,
    info,
    rows,
    columns,
    maxRows = 500,
    emptyText = 'No data',
    totalCount,
}: DataTableCardProps<T>) {
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const cardBase = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'
    const subtitleCls = isLight ? 'text-slate-500' : 'text-gray-400'
    const thCls = isLight
        ? 'text-slate-600 bg-slate-50 border-slate-200'
        : 'text-gray-300 bg-white/5 border-white/10'
    const tdCls = isLight ? 'text-slate-700 border-slate-100' : 'text-gray-200 border-white/5'
    const zebraCls = isLight ? 'bg-slate-50/50' : 'bg-white/5'

    const [sortKey, setSortKey] = useState<string | null>(null)
    const [sortDir, setSortDir] = useState<SortDir>(null)

    function toggleSort(col: Column<T>) {
        if (col.sortable === false) return
        if (sortKey !== col.key) {
            setSortKey(col.key)
            setSortDir('asc')
            return
        }
        if (sortDir === 'asc') {
            setSortDir('desc')
            return
        }
        setSortKey(null)
        setSortDir(null)
    }

    const sorted = useMemo(() => {
        if (!sortKey || !sortDir) return rows
        const col = columns.find((c) => c.key === sortKey)
        if (!col) return rows
        const dir = sortDir === 'asc' ? 1 : -1
        const pick = (r: T) =>
            col.sortValue ? col.sortValue(r) : defaultSortValue(r, sortKey)
        return [...rows].sort((a, b) => {
            const av = pick(a)
            const bv = pick(b)
            // Treat null / undefined / "" as "smallest" so they always
            // sit on the bottom in desc and top in asc.
            const ae = av === null || av === undefined || av === ''
            const be = bv === null || bv === undefined || bv === ''
            if (ae && be) return 0
            if (ae) return 1
            if (be) return -1
            // Numbers compare numerically; otherwise locale-aware string compare.
            if (typeof av === 'number' && typeof bv === 'number') {
                return (av - bv) * dir
            }
            return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir
        })
    }, [rows, sortKey, sortDir, columns])

    const visible = useMemo(() => sorted.slice(0, maxRows), [sorted, maxRows])
    const hasMore = sorted.length > maxRows

    return (
        <div className={`rounded-xl border p-4 ${cardBase}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <TitleWithInfo title={title} subtitle={subtitle} info={info} />
                <div className={`text-xs ${subtitleCls}`}>
                    {totalCount !== undefined
                        ? `${Math.min(visible.length, maxRows)} / ${totalCount}`
                        : `${visible.length} rows`}
                </div>
            </div>
            {rows.length === 0 ? (
                <div
                    className={`text-center text-xs py-8 ${
                        isLight ? 'text-slate-400' : 'text-gray-500'
                    }`}
                >
                    {emptyText}
                </div>
            ) : (
                <div className="overflow-auto max-h-[480px] border rounded-md">
                    <table className="min-w-full text-xs">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                {columns.map((c) => {
                                    const sortable = c.sortable !== false
                                    const isActive = sortKey === c.key
                                    return (
                                        <th
                                            key={c.key}
                                            className={`px-2 py-2 text-left font-medium border-b ${thCls} ${
                                                c.width ?? ''
                                            } ${c.alignRight ? 'text-right' : ''} ${
                                                sortable ? 'cursor-pointer select-none' : ''
                                            }`}
                                            onClick={() => toggleSort(c)}
                                        >
                                            <span
                                                className={`inline-flex items-center gap-1 ${
                                                    c.alignRight ? 'justify-end w-full' : ''
                                                }`}
                                            >
                                                {c.label}
                                                {sortable && (
                                                    isActive ? (
                                                        sortDir === 'asc' ? (
                                                            <ChevronUp className="w-3 h-3 text-blue-400" />
                                                        ) : (
                                                            <ChevronDown className="w-3 h-3 text-blue-400" />
                                                        )
                                                    ) : (
                                                        <ChevronsUpDown className="w-3 h-3 opacity-30" />
                                                    )
                                                )}
                                            </span>
                                        </th>
                                    )
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {visible.map((row, i) => (
                                <tr
                                    key={i}
                                    className={i % 2 === 1 ? zebraCls : ''}
                                >
                                    {columns.map((c) => (
                                        <td
                                            key={c.key}
                                            className={`px-2 py-1.5 border-b align-top ${tdCls} ${
                                                c.alignRight ? 'text-right tabular-nums' : ''
                                            }`}
                                        >
                                            {c.render ? c.render(row) : defaultCell(row, c.key)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {hasMore && (
                        <div
                            className={`text-center py-2 text-[11px] ${
                                isLight ? 'text-slate-400 bg-slate-50' : 'text-gray-500 bg-white/5'
                            }`}
                        >
                            Showing first {maxRows} of {sorted.length} rows
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
