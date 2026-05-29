'use client'

/**
 * Ohla Timing Variances — daily react / response / cycle latency.
 *
 *  - 3 KPI tiles: window-average react / response / cycle seconds
 *    (p95 surfaced as the subtitle for tail-latency context).
 *  - 3 daily trend charts, one per metric, each plotting avg + p50 + p95.
 *
 * Metric source: chatbot timing fields on activities.interactions, populated
 * by the single-chats export sync. Until the export ships those fields the
 * series are empty (the backend returns null aggregates → chart gaps).
 *
 * Date slicer + range are shared across all Ohla pages via useOhlaDateRange.
 */

import { Clock, RefreshCw, Timer } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useOhlaChatbotReport } from '@/lib/hooks/useOhlaChatbotReport'
import { KpiCard } from '@/components/ops_dashboard/KpiCard'
import {
    TrendLineCard,
    type TrendChartRow,
} from '@/components/ops_dashboard/TrendLineCard'
import { useOhlaDateRange } from '@/lib/hooks/useOhlaDateRange'
import { TranslatedAutoRefresh } from '@/components/ops_dashboard/TranslatedAutoRefresh'
import type { TimingVariancesDailyRow } from '@/lib/api/ohla_chatbot'

// avg / p50 / p95 line colours (shared across the three per-metric charts).
const SERIES_COLORS = { avg: '#3b82f6', p50: '#10b981', p95: '#f59e0b' } as const

function fmtSec(n: number | null | undefined): string {
    return n === null || n === undefined ? '—' : `${n.toFixed(1)}s`
}

const ZERO_STAT = { avg: null, p50: null, p95: null }

export function TimingVariancesDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const { range: { from, to }, setRange } = useOhlaDateRange()
    const { data, loading, error, refetch } = useOhlaChatbotReport('timing-variances', {
        from,
        to,
    })

    const block = data?.current
    const kpis = block?.kpis
    const dailyRows: TimingVariancesDailyRow[] = block?.charts.daily ?? []

    // Build per-metric chart rows. recharts treats null as a gap (no point),
    // which is what we want for days without timing data. The chart's loose
    // row type only allows string|number, so cast at the boundary.
    const buildRows = (
        pick: (r: TimingVariancesDailyRow) => {
            avg: number | null
            p50: number | null
            p95: number | null
        },
    ): TrendChartRow[] =>
        dailyRows.map((r) => ({ bucket: r.date, ...pick(r) })) as unknown as TrendChartRow[]

    // Computed directly (no manual memo) — the React Compiler memoizes for us.
    const reactRows = buildRows((r) => ({
        avg: r.react_avg,
        p50: r.react_p50,
        p95: r.react_p95,
    }))
    const responseRows = buildRows((r) => ({
        avg: r.response_avg,
        p50: r.response_p50,
        p95: r.response_p95,
    }))
    const cycleRows = buildRows((r) => ({
        avg: r.cycle_avg,
        p50: r.cycle_p50,
        p95: r.cycle_p95,
    }))

    const series = [
        { key: 'avg', label: t('timingVariances.series.avg'), color: SERIES_COLORS.avg },
        { key: 'p50', label: t('timingVariances.series.p50'), color: SERIES_COLORS.p50 },
        { key: 'p95', label: t('timingVariances.series.p95'), color: SERIES_COLORS.p95 },
    ]

    const react = kpis?.react ?? ZERO_STAT
    const response = kpis?.response ?? ZERO_STAT
    const cycle = kpis?.cycle ?? ZERO_STAT

    const bg = isLight ? 'bg-slate-50' : 'bg-slate-900'
    const textMain = isLight ? 'text-slate-900' : 'text-gray-100'
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400'
    const chipBtn = isLight
        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
        : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
    const mutedCardCls = isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'

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
                        <Timer className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>
                            {t('timingVariances.title')}
                        </h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>
                            {t('timingVariances.subtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <TranslatedAutoRefresh
                        onRefresh={() => void refetch()}
                        storageKey="ops-dashboard:ohla-timing-variances:auto-refresh"
                    />
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
                    {t('filters.rowCount', { count: kpis?.sample_count ?? 0 })}
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

                {/* KPI tiles — window-average per metric, p95 as subtitle */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    <KpiCard
                        label={t('timingVariances.kpis.reactAvg')}
                        value={fmtSec(react.avg)}
                        valueSize="xl"
                        subtitle={t('timingVariances.kpis.p95Sub', { value: fmtSec(react.p95) })}
                        tooltip={t('timingVariances.kpis.reactInfo')}
                        className="h-full"
                    />
                    <KpiCard
                        label={t('timingVariances.kpis.responseAvg')}
                        value={fmtSec(response.avg)}
                        valueSize="xl"
                        subtitle={t('timingVariances.kpis.p95Sub', {
                            value: fmtSec(response.p95),
                        })}
                        tooltip={t('timingVariances.kpis.responseInfo')}
                        className="h-full"
                    />
                    <KpiCard
                        label={t('timingVariances.kpis.cycleAvg')}
                        value={fmtSec(cycle.avg)}
                        valueSize="xl"
                        subtitle={t('timingVariances.kpis.p95Sub', { value: fmtSec(cycle.p95) })}
                        tooltip={t('timingVariances.kpis.cycleInfo')}
                        className="h-full"
                    />
                </div>

                {/* Per-metric daily trend (avg / p50 / p95) */}
                <div className="grid grid-cols-1 gap-2">
                    <TrendLineCard
                        title={t('timingVariances.charts.reactTrend')}
                        info={t('timingVariances.charts.secondsAxis')}
                        data={reactRows}
                        series={series}
                        height={240}
                        zoomable
                        emptyText={t('common.noData')}
                    />
                    <TrendLineCard
                        title={t('timingVariances.charts.responseTrend')}
                        info={t('timingVariances.charts.secondsAxis')}
                        data={responseRows}
                        series={series}
                        height={240}
                        zoomable
                        emptyText={t('common.noData')}
                    />
                    <TrendLineCard
                        title={t('timingVariances.charts.cycleTrend')}
                        info={t('timingVariances.charts.secondsAxis')}
                        data={cycleRows}
                        series={series}
                        height={240}
                        zoomable
                        emptyText={t('common.noData')}
                    />
                </div>
            </div>
        </div>
    )
}
