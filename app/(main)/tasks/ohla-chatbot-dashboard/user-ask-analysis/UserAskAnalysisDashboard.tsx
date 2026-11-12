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

import { useMemo } from 'react'
import { Clock, RefreshCw, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useOhlaChatbotReport } from '@/lib/hooks/useOhlaChatbotReport'
import { OHLA_PALETTE } from '@/lib/ohla/colors'
import { KpiCard } from '@/components/ops_dashboard/KpiCard'
import { DonutCard } from '@/components/ops_dashboard/DonutCard'
import { StackedBarPercentLineCard } from '@/components/ops_dashboard/StackedBarPercentLineCard'
import { useOhlaDateRange } from '@/lib/hooks/useOhlaDateRange'
import { TranslatedAutoRefresh } from '@/components/ops_dashboard/TranslatedAutoRefresh';

function fmtNum(n: number): string {
    return n.toLocaleString()
}

function pct(v: number, digits = 1): string {
    return `${(v * 100).toFixed(digits)}%`
}

const ZERO_KPIS = {
    user_ask_count: 0,
    faq_match_rate: 0,
    overall_match_rate: 0,
    faq_matched_count: 0,
    action_chain_count: 0,
    kb_matched_count: 0,
    other_count: 0,
} as const

export function UserAskAnalysisDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const { range: { from, to }, setRange } = useOhlaDateRange()
    const { data, loading, error, refetch } = useOhlaChatbotReport('user-ask', { from, to })

    const block = data?.current
    const kpis = block?.kpis ?? ZERO_KPIS
    const dailyRows = block?.charts.behaviour_daily ?? []
    const distribution = block?.charts.behaviour_distribution ?? []

    // Map BE bucket strings -> i18n labels and stable colors. The 4-bucket
    // donut order matches the FE PBIX layout: faq -> ac -> interaction -> irrelevant.
    const COLOR_BY_BUCKET: Record<string, string> = {
        faqMatched: OHLA_PALETTE.faqMatched,
        actionChainMatched: OHLA_PALETTE.actionChainMatched,
        interaction: OHLA_PALETTE.interaction,
        irrelevant: OHLA_PALETTE.irrelevant,
    }
    const LABEL_KEY_BY_BUCKET: Record<string, string> = {
        faqMatched: 'userAsk.behaviour.faqMatched',
        actionChainMatched: 'userAsk.behaviour.actionChainMatched',
        interaction: 'userAsk.behaviour.interaction',
        irrelevant: 'userAsk.behaviour.irrelevant',
    }

    const behaviourSlices = useMemo(
        () =>
            distribution.map((b) => ({
                name: t(LABEL_KEY_BY_BUCKET[b.bucket] ?? b.bucket),
                value: b.count,
                color: COLOR_BY_BUCKET[b.bucket],
            })),
        [distribution, t],
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
                <div className="flex items-center gap-2">
                    <TranslatedAutoRefresh onRefresh={() => void refetch()} storageKey="ops-dashboard:ohla-user-ask:auto-refresh" />
                    <button
                    onClick={() => void refetch()}
                    className={`p-2 rounded-lg border transition-colors ${chipBtn}`}
                    title={t('common.refresh')}
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                </div>
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
                    {t('filters.rowCount', { count: kpis.user_ask_count })}
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

                {/* Top block — PBIX layout:
                 *   Left 9 cols (12-grid):
                 *     Row a: big "User Ask#" tile (col-span 6) + FAQ MR (3) + Overall MR (3)
                 *     Row b: 4 secondary KPIs equally spread (FAQ Matched# / Action Chain# / KB Matched# / Other#)
                 *   Right 3 cols: Behaviour Distribution donut (spans both rows). */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-1 mb-1">
                    <div className="md:col-span-9 grid grid-cols-1 md:grid-cols-12 gap-1">
                        <div className="md:col-span-6">
                            <KpiCard
                                label={t('userAsk.kpis.userAsk')}
                                value={fmtNum(kpis.user_ask_count)}
                                valueSize="xl"
                                className="h-full"
                                tooltip={t('userAsk.kpis.userAskInfo')}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <KpiCard
                                label={t('userAsk.kpis.faqMatchRate')}
                                value={pct(kpis.faq_match_rate)}
                                valueSize="xl"
                                className="h-full"
                                tooltip={t('userAsk.kpis.faqMatchRateInfo')}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <KpiCard
                                label={t('userAsk.kpis.overallMatchRate')}
                                value={pct(kpis.overall_match_rate)}
                                valueSize="xl"
                                className="h-full"
                                tooltip={t('userAsk.kpis.overallMatchRateInfo')}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <KpiCard
                                label={t('userAsk.kpis.faqMatched')}
                                value={fmtNum(kpis.faq_matched_count)}
                                valueSize="lg"
                                className="h-full"
                                tooltip={t('userAsk.kpis.faqMatchedInfo')}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <KpiCard
                                label={t('userAsk.kpis.actionChain')}
                                value={fmtNum(kpis.action_chain_count)}
                                valueSize="lg"
                                className="h-full"
                                tooltip={t('userAsk.kpis.actionChainInfo')}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <KpiCard
                                label={t('userAsk.kpis.kbMatched')}
                                value={fmtNum(kpis.kb_matched_count)}
                                valueSize="lg"
                                className="h-full"
                                tooltip={t('userAsk.kpis.kbMatchedInfo')}
                            />
                        </div>
                        <div className="md:col-span-3">
                            <KpiCard
                                label={t('userAsk.kpis.other')}
                                value={fmtNum(kpis.other_count)}
                                valueSize="lg"
                                className="h-full"
                                tooltip={t('userAsk.kpis.otherInfo')}
                            />
                        </div>
                    </div>
                    <div className="md:col-span-3">
                        <DonutCard
                            title={t('userAsk.charts.behaviourDistribution')}
                            data={behaviourSlices}
                            height={264}
                            emptyText={t('common.noData')}
                        />
                    </div>
                </div>

                {/* Row 3 — combo chart: stacked bar + 2 match-rate lines.
                 *  Server returns per-day buckets already classified; map snake
                 *  case to the chart's expected keys. */}
                <StackedBarPercentLineCard
                    title={t('userAsk.charts.behaviourAndMatchRateTrend')}
                    data={dailyRows.map((d) => ({
                        day: d.date,
                        faqMatched: d.faq_matched,
                        actionChainMatched: d.action_chain_matched,
                        interaction: d.interaction,
                        irrelevant: d.irrelevant,
                        faqMatchRate: d.faq_match_rate,
                        overallMatchRate: d.overall_match_rate,
                    }))}
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
