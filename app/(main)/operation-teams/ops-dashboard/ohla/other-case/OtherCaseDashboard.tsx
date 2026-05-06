'use client'

/**
 * Ohla Other Case Analysis — Power BI "Other Case Analysis" page port.
 *
 * Layout (PBIX parity):
 *  - Top left: big Other# KPI tile
 *  - Top right: 3-slice pie (Interaction / Irrelevant / unmatched_anywhere)
 *  - Mid: per-day stacked bar of the same 3 categories
 *  - Bottom: details table
 */

import { useMemo, useState } from 'react'
import { Clock, RefreshCw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useOhla } from '@/lib/hooks/useOhla'
import {
    computeOtherKpis,
    filterByDateRange,
    groupOtherByDay,
} from '@/lib/ohla/aggregate'
import { classifyAsk, classifyOther } from '@/lib/ohla/classify'
import { OHLA_PALETTE } from '@/lib/ohla/colors'
import type { OhlaRow } from '@/lib/ohla/types'
import { KpiCard } from '@/components/ops_dashboard/KpiCard'
import { DonutCard } from '@/components/ops_dashboard/DonutCard'
import { StackedBarPercentLineCard } from '@/components/ops_dashboard/StackedBarPercentLineCard'
import { DataTableCard, type Column } from '@/components/ops_dashboard/DataTableCard'

function defaultDateRange(): { from: string; to: string } {
    return { from: '2025-07-13', to: '2026-03-02' }
}

function fmtNum(n: number): string {
    return n.toLocaleString()
}

function quarterOf(m: number): string {
    return `Qtr ${Math.floor((m - 1) / 3) + 1}`
}

function monthName(m: number): string {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]
}

interface DetailRow {
    year: number
    quarter: string
    month: string
    day: number
    behaviour: string
    userActionCorrected: string | null
    actorStableId: string
    userContent: string | null
    response: string | null
}

function toDetailRow(r: OhlaRow, behaviourLabel: string): DetailRow {
    const d = new Date(r.createdAt)
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    return {
        year: y,
        quarter: quarterOf(m),
        month: monthName(m),
        day: d.getUTCDate(),
        behaviour: behaviourLabel,
        userActionCorrected: r.userActionCorrected,
        actorStableId: r.actorStableId,
        userContent: r.userContent,
        response: r.responseText,
    }
}

export function OtherCaseDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const [{ from, to }, setRange] = useState(defaultDateRange)
    const { rows, loading, error, refetch } = useOhla({ from, to })

    const filtered = useMemo(() => filterByDateRange(rows, from, to), [rows, from, to])
    const kpis = useMemo(() => computeOtherKpis(filtered), [filtered])
    const daily = useMemo(() => groupOtherByDay(filtered), [filtered])

    const slices = useMemo(
        () => [
            {
                name: t('otherCase.categories.interaction'),
                value: kpis.interaction,
                color: OHLA_PALETTE.interaction,
            },
            {
                name: t('otherCase.categories.irrelevant'),
                value: kpis.irrelevant,
                color: OHLA_PALETTE.irrelevant,
            },
            {
                name: t('otherCase.categories.unmatchedAnywhere'),
                value: kpis.unmatchedAnywhere,
                color: OHLA_PALETTE.unmatchedAnywhere,
            },
        ],
        [kpis, t],
    )

    const detailRows = useMemo(() => {
        const out: DetailRow[] = []
        for (const r of filtered) {
            if (r.behaviour !== 'query') continue
            if (classifyAsk(r) !== 'other') continue
            const c = classifyOther(r)
            const label =
                c === 'interaction'
                    ? t('otherCase.categories.interaction')
                    : c === 'irrelevant'
                      ? t('otherCase.categories.irrelevant')
                      : t('otherCase.categories.unmatchedAnywhere')
            out.push(toDetailRow(r, label))
        }
        return out
    }, [filtered, t])

    const columns: Column<DetailRow>[] = [
        { key: 'year', label: t('otherCase.columns.year') },
        { key: 'quarter', label: t('otherCase.columns.quarter') },
        { key: 'month', label: t('otherCase.columns.month') },
        { key: 'day', label: t('otherCase.columns.day'), alignRight: true },
        { key: 'behaviour', label: t('otherCase.columns.behaviour') },
        { key: 'userActionCorrected', label: t('otherCase.columns.userActionCorrected') },
        { key: 'actorStableId', label: t('otherCase.columns.wecomId') },
        { key: 'userContent', label: t('otherCase.columns.userContent') },
        { key: 'response', label: t('otherCase.columns.response') },
    ]

    const bg = isLight ? 'bg-slate-50' : 'bg-slate-900'
    const textMain = isLight ? 'text-slate-900' : 'text-gray-100'
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400'
    const chipBtn = isLight
        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
        : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
    const mutedCardCls = isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] overflow-hidden p-4 gap-3 ${bg}`}>
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isLight
                                ? 'bg-orange-100 text-orange-600'
                                : 'bg-orange-500/20 text-orange-400'
                        }`}
                    >
                        <Search className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>
                            {t('otherCase.title')}
                        </h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>{t('otherCase.subtitle')}</p>
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
                    className={`px-2 py-1 rounded border text-xs ${
                        isLight
                            ? 'bg-white border-slate-200 text-slate-800'
                            : 'bg-slate-900 border-white/10 text-gray-100'
                    }`}
                />
                <span className={textMuted}>→</span>
                <input
                    type="date"
                    value={to ?? ''}
                    onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                    className={`px-2 py-1 rounded border text-xs ${
                        isLight
                            ? 'bg-white border-slate-200 text-slate-800'
                            : 'bg-slate-900 border-white/10 text-gray-100'
                    }`}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                    <KpiCard label={t('otherCase.kpis.other')} value={fmtNum(kpis.other)} valueSize="xl" />
                    <DonutCard
                        title={t('otherCase.charts.distribution')}
                        data={slices}
                        height={220}
                        emptyText={t('common.noData')}
                    />
                </div>

                <div className="mb-3">
                    <StackedBarPercentLineCard
                        title={t('otherCase.charts.dailyTrend')}
                        data={daily.map((d) => ({ ...d }))}
                        xKey="day"
                        height={240}
                        stackedKeys={[
                            { key: 'interaction', label: t('otherCase.categories.interaction'), color: OHLA_PALETTE.interaction },
                            { key: 'irrelevant', label: t('otherCase.categories.irrelevant'), color: OHLA_PALETTE.irrelevant },
                            { key: 'unmatched_anywhere', label: t('otherCase.categories.unmatchedAnywhere'), color: OHLA_PALETTE.unmatchedAnywhere },
                        ]}
                        emptyText={t('common.noData')}
                    />
                </div>

                <DataTableCard
                    title={t('otherCase.charts.details')}
                    rows={detailRows}
                    columns={columns}
                    totalCount={detailRows.length}
                    emptyText={t('common.noData')}
                />
            </div>
        </div>
    )
}
