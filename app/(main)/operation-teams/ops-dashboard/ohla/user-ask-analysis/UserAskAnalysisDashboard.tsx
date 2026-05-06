'use client'

/**
 * Ohla User Ask Analysis — Power BI "User Ask Analysis" page port.
 *
 * Layout mirrors the PBIX (see docs screenshot):
 *  - Top left: big User Ask# KPI tile + two mini match-rate readouts
 *  - Top right: Behaviour Distribution donut (faq/ac/interaction/irrelevant)
 *  - Mid: 4 small KPI cards — FAQ Matched# / Action Chain# / KB Matched# / Other#
 *  - Bottom: full-width stacked-bar + dual match-rate line combo
 *
 * All KPIs and series use PBIX-parity DAX:
 *   FAQ Match Rate_2  = FAQ / (Queries - Action Chain - KB - Interactions)
 *   Overall Match Rate_2 = (KB + FAQ + AC + Interactions) / Queries
 *
 * Date slicer default: from the 1st of the current month through today.
 */

import { useMemo, useState } from 'react'
import { Clock, RefreshCw, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useOhla } from '@/lib/hooks/useOhla'
import {
    computeAskKpis,
    filterByDateRange,
    groupAskByDay,
} from '@/lib/ohla/aggregate'
import { OHLA_PALETTE } from '@/lib/ohla/colors'
import { KpiCard } from '@/components/ops_dashboard/KpiCard'
import { DonutCard } from '@/components/ops_dashboard/DonutCard'
import { StackedBarPercentLineCard } from '@/components/ops_dashboard/StackedBarPercentLineCard'

function defaultDateRange(): { from: string; to: string } {
    const now = new Date()
    const to = now.toISOString().slice(0, 10)
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    return { from, to }
}

function fmtNum(n: number): string {
    return n.toLocaleString()
}

function pct(v: number, digits = 1): string {
    return `${(v * 100).toFixed(digits)}%`
}

export function UserAskAnalysisDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const [{ from, to }, setRange] = useState(defaultDateRange)
    const { rows, loading, error, refetch } = useOhla({ from, to })

    const filtered = useMemo(() => filterByDateRange(rows, from, to), [rows, from, to])
    const kpis = useMemo(() => computeAskKpis(filtered), [filtered])
    const daily = useMemo(() => groupAskByDay(filtered), [filtered])

    const behaviourSlices = useMemo(
        () => [
            {
                name: t('userAsk.behaviour.faqMatched'),
                value: kpis.faqMatchedBehaviour,
                color: OHLA_PALETTE.faqMatched,
            },
            {
                name: t('userAsk.behaviour.actionChainMatched'),
                value: kpis.actionChainMatched,
                color: OHLA_PALETTE.actionChainMatched,
            },
            {
                name: t('userAsk.behaviour.interaction'),
                value: kpis.interaction,
                color: OHLA_PALETTE.interaction,
            },
            {
                name: t('userAsk.behaviour.irrelevant'),
                value: kpis.irrelevant,
                color: OHLA_PALETTE.irrelevant,
            },
        ],
        [kpis, t],
    )

    const bg = isLight ? 'bg-slate-50' : 'bg-slate-900'
    const textMain = isLight ? 'text-slate-900' : 'text-gray-100'
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400'
    const chipBtn = isLight
        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
        : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
    const mutedCardCls = isLight
        ? 'bg-white border-slate-200'
        : 'bg-white/5 border-white/10'

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] overflow-hidden p-4 gap-3 ${bg}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isLight
                                ? 'bg-indigo-100 text-indigo-600'
                                : 'bg-indigo-500/20 text-indigo-400'
                        }`}
                    >
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>
                            {t('userAsk.title')}
                        </h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>
                            {t('userAsk.subtitle')}
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

            {/* Date slicer */}
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

            {/* Scrollable main */}
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
                        <button
                            onClick={() => void refetch()}
                            className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${
                                isLight
                                    ? 'bg-red-100 hover:bg-red-200 text-red-800'
                                    : 'bg-red-500/20 hover:bg-red-500/30 text-red-200'
                            }`}
                        >
                            {t('common.retry')}
                        </button>
                    </div>
                )}

                {/* Row 1 — big User Ask# tile + 2 mini rates + Behaviour donut */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <div className="md:col-span-1">
                        <KpiCard
                            label={t('userAsk.kpis.userAsk')}
                            value={fmtNum(kpis.userAsk)}
                            valueSize="xl"
                            className="h-full"
                        />
                    </div>
                    <div className={`md:col-span-1 rounded-xl border p-4 flex flex-col justify-center gap-4 ${mutedCardCls}`}>
                        <div>
                            <p className={`text-[10px] uppercase tracking-wide ${textMuted}`}>
                                {t('userAsk.kpis.faqMatchRate')}
                            </p>
                            <p className={`text-3xl font-bold ${textMain}`}>
                                {pct(kpis.faqMatchRate)}
                            </p>
                        </div>
                        <div>
                            <p className={`text-[10px] uppercase tracking-wide ${textMuted}`}>
                                {t('userAsk.kpis.overallMatchRate')}
                            </p>
                            <p className={`text-3xl font-bold ${textMain}`}>
                                {pct(kpis.overallMatchRate)}
                            </p>
                        </div>
                    </div>
                    <div className="md:col-span-1">
                        <DonutCard
                            title={t('userAsk.charts.behaviourDistribution')}
                            data={behaviourSlices}
                            height={220}
                            emptyText={t('common.noData')}
                        />
                    </div>
                </div>

                {/* Row 2 — 4 category KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <KpiCard label={t('userAsk.kpis.faqMatched')} value={fmtNum(kpis.faqMatched)} valueSize="lg" />
                    <KpiCard label={t('userAsk.kpis.actionChain')} value={fmtNum(kpis.actionChain)} valueSize="lg" />
                    <KpiCard label={t('userAsk.kpis.kbMatched')} value={fmtNum(kpis.kbMatched)} valueSize="lg" />
                    <KpiCard label={t('userAsk.kpis.other')} value={fmtNum(kpis.other)} valueSize="lg" />
                </div>

                {/* Row 3 — combo chart: stacked bar + 2 match-rate lines */}
                <StackedBarPercentLineCard
                    title={t('userAsk.charts.behaviourAndMatchRateTrend')}
                    data={daily.map((d) => ({ ...d }))}
                    xKey="day"
                    height={320}
                    leftAxisLabel={t('userAsk.charts.countOfBehaviour')}
                    rightAxisLabel={t('userAsk.charts.matchRateLabel')}
                    stackedKeys={[
                        { key: 'faqMatched', label: t('userAsk.behaviour.faqMatched'), color: OHLA_PALETTE.faqMatched },
                        { key: 'actionChainMatched', label: t('userAsk.behaviour.actionChainMatched'), color: OHLA_PALETTE.actionChainMatched },
                        { key: 'interaction', label: t('userAsk.behaviour.interaction'), color: OHLA_PALETTE.interaction },
                        { key: 'irrelevant', label: t('userAsk.behaviour.irrelevant'), color: OHLA_PALETTE.irrelevant },
                    ]}
                    lineKeys={[
                        { key: 'faqMatchRate', label: t('userAsk.kpis.faqMatchRate'), color: OHLA_PALETTE.faqMatchRateLine },
                        { key: 'overallMatchRate', label: t('userAsk.kpis.overallMatchRate'), color: OHLA_PALETTE.overallMatchRateLine },
                    ]}
                    emptyText={t('common.noData')}
                />
            </div>
        </div>
    )
}
