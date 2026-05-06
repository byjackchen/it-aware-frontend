'use client';

/**
 * DataTableCard — titled card wrapping a scrollable HTML table.
 *
 * Used by Ohla Agent Support / Survey Details / Other Case / Raw Data
 * pages for the PBIX-parity "Details" tables. Caps at `maxRows` to
 * avoid rendering 40K DOM rows; real pagination can come later.
 */

import { useTheme } from '@/lib/contexts/theme-context'
import { useMemo, type ReactNode } from 'react'

export interface Column<T> {
    key: string
    label: string
    /** Optional cell renderer. Defaults to `String(row[key])` with '—' for null/undefined. */
    render?: (row: T) => ReactNode
    /** Optional column width in Tailwind (e.g. 'w-20'). */
    width?: string
    /** Align right for numeric columns. */
    alignRight?: boolean
}

export interface DataTableCardProps<T> {
    title: string
    subtitle?: string
    rows: T[]
    columns: Column<T>[]
    maxRows?: number
    emptyText?: string
    /** Total row-count shown in the subtitle if provided (useful when rows is sliced). */
    totalCount?: number
}

function defaultCell<T>(row: T, key: string): ReactNode {
    const v = (row as unknown as Record<string, unknown>)[key]
    if (v === null || v === undefined || v === '') return '—'
    return String(v)
}

export function DataTableCard<T>({
    title,
    subtitle,
    rows,
    columns,
    maxRows = 500,
    emptyText = 'No data',
    totalCount,
}: DataTableCardProps<T>) {
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const cardBase = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'
    const titleCls = isLight ? 'text-slate-800' : 'text-white'
    const subtitleCls = isLight ? 'text-slate-500' : 'text-gray-400'
    const thCls = isLight
        ? 'text-slate-600 bg-slate-50 border-slate-200'
        : 'text-gray-300 bg-white/5 border-white/10'
    const tdCls = isLight ? 'text-slate-700 border-slate-100' : 'text-gray-200 border-white/5'
    const zebraCls = isLight ? 'bg-slate-50/50' : 'bg-white/5'

    const visible = useMemo(() => rows.slice(0, maxRows), [rows, maxRows])
    const hasMore = rows.length > maxRows

    return (
        <div className={`rounded-xl border p-4 ${cardBase}`}>
            <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                    <h3 className={`text-sm font-medium ${titleCls}`}>{title}</h3>
                    {subtitle && <p className={`text-xs mt-0.5 ${subtitleCls}`}>{subtitle}</p>}
                </div>
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
                                {columns.map((c) => (
                                    <th
                                        key={c.key}
                                        className={`px-2 py-2 text-left font-medium border-b ${thCls} ${
                                            c.width ?? ''
                                        } ${c.alignRight ? 'text-right' : ''}`}
                                    >
                                        {c.label}
                                    </th>
                                ))}
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
                            Showing first {maxRows} of {rows.length} rows
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
