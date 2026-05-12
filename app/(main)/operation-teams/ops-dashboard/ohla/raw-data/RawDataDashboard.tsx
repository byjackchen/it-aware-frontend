'use client'

/**
 * Ohla Raw Data — Power BI "Raw Data" page port.
 *
 * A flat exhaustive table view of every chatbot interaction in the
 * window: one row per `activities.interactions` row, with the full
 * decoded OhlaRow fields exposed. No analytics, no aggregation —
 * a debugging / export window for the data team.
 *
 * Date slicer drives the table; default window is "1st of current
 * month through today". We cap rendered rows via DataTableCard's
 * built-in maxRows to keep the DOM happy.
 */

import { useMemo, useState } from 'react'
import { Clock, RefreshCw, Database } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useOhla } from '@/lib/hooks/useOhla'
import { filterByDateRange } from '@/lib/ohla/aggregate'
import type { OhlaRow } from '@/lib/ohla/types'
import { DataTableCard, type Column } from '@/components/ops_dashboard/DataTableCard'
import { useOhlaDateRange } from '@/lib/hooks/useOhlaDateRange'
import { maskWecomId } from '@/lib/ohla/mask'
import { ExpandableText } from '@/components/ohla/ExpandableText'

function fmtNum(n: number): string {
    return n.toLocaleString()
}

/** Truncate long text fields so the table stays scannable. */
function truncate(s: string | null | undefined, n = 60): string {
    if (!s) return '—'
    return s.length > n ? `${s.slice(0, n)}…` : s
}

export function RawDataDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const { range: { from, to }, setRange } = useOhlaDateRange()
    const { rows, loading, error, refetch } = useOhla({ from, to })
    const filtered = useMemo(() => filterByDateRange(rows, from, to), [rows, from, to])

    const columns: Column<OhlaRow>[] = [
        {
            key: 'createdDate',
            label: t('rawData.columns.date'),
            width: 'w-24',
        },
        {
            key: 'createdAt',
            label: t('rawData.columns.time'),
            width: 'w-20',
            render: (r) => r.createdAt.slice(11, 19), // HH:MM:SS
        },
        { key: 'actorStableId', label: t('rawData.columns.wecomId'), render: (r) => maskWecomId(r.actorStableId) },
        { key: 'behaviour', label: t('rawData.columns.behaviour'), width: 'w-24' },
        { key: 'userAction', label: t('rawData.columns.userAction') },
        { key: 'userActionCorrected', label: t('rawData.columns.userActionCorrected'), width: 'w-20' },
        {
            key: 'userContent',
            label: t('rawData.columns.userContent'),
            render: (r) => <ExpandableText text={r.userContent} />,
        },
        {
            key: 'responseText',
            label: t('rawData.columns.response'),
            render: (r) => <ExpandableText text={r.responseText} />,
        },
        {
            key: 'shownFaqCount',
            label: t('rawData.columns.shownFaqs'),
            alignRight: true,
        },
        { key: 'ticketId', label: t('rawData.columns.ticketId') },
        { key: 'ticketReason', label: t('rawData.columns.ticketReason'), render: (r) => <ExpandableText text={r.ticketReason} /> },
        {
            key: 'isHelpful',
            label: t('rawData.columns.isHelpful'),
            width: 'w-20',
            render: (r) => (r.isHelpful === null ? '—' : r.isHelpful ? '✓' : '✗'),
        },
        {
            key: 'helpfulScore',
            label: t('rawData.columns.helpfulScore'),
            alignRight: true,
        },
        {
            key: 'surveyReceived',
            label: t('rawData.columns.surveyReceived'),
            width: 'w-20',
            render: (r) => (r.surveyReceived ? '✓' : '—'),
        },
        {
            key: 'surveyRate',
            label: t('rawData.columns.surveyRate'),
            alignRight: true,
            render: (r) => (typeof r.surveyRate === 'number' ? r.surveyRate.toFixed(2) : '—'),
        },
        { key: 'region', label: t('rawData.columns.region') },
        { key: 'country', label: t('rawData.columns.country') },
        { key: 'businessGroup', label: t('rawData.columns.businessGroup') },
        {
            key: 'isVip',
            label: t('rawData.columns.vip'),
            width: 'w-16',
            render: (r) => (r.isVip ? 'VIP' : '—'),
        },
        { key: 'cycleId', label: t('rawData.columns.cycleId') },
        { key: 'sessionId', label: t('rawData.columns.sessionId') },
        { key: 'deviceType', label: t('rawData.columns.deviceType') },
        {
            key: 'primaryResponseTemplate',
            label: t('rawData.columns.primaryTemplate'),
        },
    ]

    const bg = isLight ? 'bg-slate-50' : 'bg-slate-900'
    const textMain = isLight ? 'text-slate-900' : 'text-gray-100'
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400'
    const chipBtn = isLight
        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
        : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
    const mutedCardCls = isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'
    const inputCls = isLight
        ? 'bg-white border-slate-200 text-slate-800'
        : 'bg-slate-900 border-white/10 text-gray-100'

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] overflow-hidden p-4 gap-3 ${bg}`}>
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isLight
                                ? 'bg-slate-200 text-slate-700'
                                : 'bg-slate-700 text-slate-200'
                        }`}
                    >
                        <Database className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>
                            {t('rawData.title')}
                        </h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>
                            {t('rawData.subtitle')}
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => void refetch()}
                    className={`p-2 rounded-lg border transition-colors ${chipBtn}`}
                    title={t('common.refresh')}
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shrink-0 ${mutedCardCls}`}
            >
                <Clock className="w-4 h-4 opacity-70" />
                <span className={textMuted}>{t('filters.dateRange')}</span>
                <input
                    type="date"
                    value={from ?? ''}
                    onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                    className={`px-2 py-1 rounded border text-xs ${inputCls}`}
                />
                <span className={textMuted}>→</span>
                <input
                    type="date"
                    value={to ?? ''}
                    onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                    className={`px-2 py-1 rounded border text-xs ${inputCls}`}
                />
                <span className={`ml-auto text-xs ${textMuted}`}>
                    {t('filters.rowCount', { count: filtered.length })}
                </span>
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
                {error && (
                    <div
                        className={`rounded-xl border p-3 mb-3 text-xs flex items-center gap-2 ${
                            isLight
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-red-500/30 bg-red-500/10 text-red-300'
                        }`}
                    >
                        <span>⚠️ {error}</span>
                    </div>
                )}

                <DataTableCard
                    title={t('rawData.charts.details')}
                    subtitle={t('rawData.subtitle')}
                    rows={filtered}
                    columns={columns}
                    totalCount={filtered.length}
                    maxRows={1000}
                    emptyText={t('common.noData')}
                    csvFilename="ohla_raw_data"
                />
            </div>
        </div>
    )
}
