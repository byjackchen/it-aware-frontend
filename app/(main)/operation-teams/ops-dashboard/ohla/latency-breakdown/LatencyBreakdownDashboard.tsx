'use client'

/**
 * Ohla Latency Breakdown — hourly latency of a chatbot turn, by phase.
 *
 * Three derived metrics (avg + p50 + p95, 3 decimals), each over its own row
 * domain so the meaningless enter_chat 0.0 cycles no longer drag the median:
 *  - Agentic Response = react_seconds (ReAct agent's first-reaction span)
 *  - Logical Response = response_seconds for non-react cycles
 *  - Post Work        = max(cycle_seconds − response_seconds, 0)
 * Plus a per-hour volume chart (total chatbot interactions in each bucket).
 *
 * Buckets are UTC hours from the backend; the FE renders them in the analyst's
 * local zone (rule 11). The date filter is local to this page (own 7-day
 * default state) and sends ISO-8601 with offset.
 */

import { useState } from 'react'
import { Clock, RefreshCw, Timer } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useTimezone } from '@/lib/contexts/timezone-context'
import { useOhlaChatbotReport } from '@/lib/hooks/useOhlaChatbotReport'
import { KpiCard } from '@/components/ops_dashboard/KpiCard'
import {
    MetricWithVolumeCard,
    type MetricWithVolumeRow,
} from '@/components/ops_dashboard/MetricWithVolumeCard'
import { TranslatedAutoRefresh } from '@/components/ops_dashboard/TranslatedAutoRefresh'
import {
    formatLocalDateTime,
    localDateTimeToIso,
    formatTzBadge,
} from '@/lib/utils/datetime'
import type { LatencyBreakdownHourlyRow } from '@/lib/api/ohla_chatbot'

// avg / p50 / p95 line colours (shared across the three per-metric charts).
const SERIES_COLORS = { avg: '#3b82f6', p50: '#10b981', p95: '#f59e0b' } as const
const VOLUME_COLOR = '#8b5cf6'

function fmtSec(n: number | null | undefined): string {
    return n === null || n === undefined ? '—' : `${n.toFixed(3)}s`
}

const ZERO_METRIC = { count: 0, avg: null, p50: null, p95: null }

// Default window: last 7 calendar days, pinned to DAY BOUNDARIES (start-of-day
// 7 days ago → end-of-today) as local wall-clock `YYYY-MM-DDTHH:MM:SS` strings
// for the <input type="datetime-local"> controls. Day boundaries (not a live
// "now" timestamp) are deliberate — matches SSC's getDefaultDateFrom/To: the
// default is computed at first render when useTimezone() is still UTC, then the
// profile zone resolves from the cookie; pinning to 00:00:00 / 23:59:59 means
// the only possible skew is ±1 calendar day near midnight (accepted), never the
// multi-hour intra-day shift a "now" timestamp would suffer when its UTC-derived
// wall-clock is later submitted as the profile zone.
function defaultRange(tz: string): { from: string; to: string } {
    const fromDay = formatLocalDateTime(
        new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        tz,
    ).slice(0, 10)
    const toDay = formatLocalDateTime(new Date(), tz).slice(0, 10)
    return { from: `${fromDay}T00:00:00`, to: `${toDay}T23:59:59` }
}

export function LatencyBreakdownDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    // Timezone follows the user's PROFILE selection (TopBar picker → cookie),
    // matching the SSC cockpit dashboards — not the raw browser zone. All three
    // touchpoints (default window, filter→ISO submission, axis display) use it.
    // useTimezone() returns DEFAULT_TIMEZONE (UTC) on the server AND the first
    // client render, then resolves from the cookie on mount — so lazy-seeding the
    // default window from it is hydration-safe (SSC SSCDashboardPage does the
    // same, and likewise does not re-seed on a mid-session zone change).
    const { timezone } = useTimezone()
    // Own 7-day window in wall-clock strings for the datetime-local pickers
    // (the shared useOhlaDateRange is month-to-date + persisted across siblings).
    const [range, setRange] = useState<{ from: string; to: string }>(() =>
        defaultRange(timezone),
    )
    const { from, to } = range

    // Rule 11: convert the local wall-clock pickers to ISO-8601 WITH OFFSET;
    // backend ensure_utc normalizes to the UTC instant.
    const dateFromIso = from ? localDateTimeToIso(from, timezone) : from
    const dateToIso = to ? localDateTimeToIso(to, timezone) : to

    const { data, loading, error, refetch } = useOhlaChatbotReport('latency-breakdown', {
        from: dateFromIso,
        to: dateToIso,
    })

    const block = data?.current
    const kpis = block?.kpis
    const hourly: LatencyBreakdownHourlyRow[] = block?.charts.hourly ?? []

    // Each chart row carries that phase's avg/p50/p95 (left-axis seconds) AND
    // its own hourly count (right-axis volume) — same 口径/domain as the metric.
    // recharts treats null as a gap; the row type only allows string|number.
    const buildRows = (
        pick: (r: LatencyBreakdownHourlyRow) => {
            avg: number | null
            p50: number | null
            p95: number | null
            count: number
        },
    ): MetricWithVolumeRow[] =>
        hourly.map((r) => ({ bucket: r.bucket, ...pick(r) })) as MetricWithVolumeRow[]

    const agenticRows = buildRows((r) => ({
        avg: r.agentic_avg,
        p50: r.agentic_p50,
        p95: r.agentic_p95,
        count: r.agentic_count,
    }))
    const logicalRows = buildRows((r) => ({
        avg: r.logical_avg,
        p50: r.logical_p50,
        p95: r.logical_p95,
        count: r.logical_count,
    }))
    const postWorkRows = buildRows((r) => ({
        avg: r.post_work_avg,
        p50: r.post_work_p50,
        p95: r.post_work_p95,
        count: r.post_work_count,
    }))

    const series = [
        { key: 'avg', label: t('latencyBreakdown.series.avg'), color: SERIES_COLORS.avg },
        { key: 'p50', label: t('latencyBreakdown.series.p50'), color: SERIES_COLORS.p50 },
        { key: 'p95', label: t('latencyBreakdown.series.p95'), color: SERIES_COLORS.p95 },
    ]

    // Hourly x-axis: render the UTC bucket instant as the analyst's local
    // "MM/DD HH". Buckets are ISO-8601 with +00:00, so Date parses the instant
    // and toLocaleString shifts it to the local zone.
    const formatHour = (bucket: string): string => {
        const ms = Date.parse(bucket)
        if (!Number.isFinite(ms)) return bucket
        return new Date(ms).toLocaleString(undefined, {
            timeZone: timezone,
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            hour12: false,
        })
    }

    const agentic = kpis?.agentic_response ?? ZERO_METRIC
    const logical = kpis?.logical_response ?? ZERO_METRIC
    const postWork = kpis?.post_work ?? ZERO_METRIC

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
                            {t('latencyBreakdown.title')}
                        </h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>
                            {t('latencyBreakdown.subtitle')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <TranslatedAutoRefresh
                        onRefresh={() => void refetch()}
                        storageKey="ops-dashboard:ohla-latency-breakdown:auto-refresh"
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
                    type="datetime-local"
                    step="1"
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
                    type="datetime-local"
                    step="1"
                    value={to ?? ''}
                    onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                    className={`px-2 py-1 rounded border text-xs ${
                        isLight
                            ? 'bg-white border-slate-200 text-slate-800'
                            : 'bg-slate-900 border-white/10 text-gray-100'
                    }`}
                />
                <span className={`text-[11px] ${textMuted}`} title={t('filters.timezoneHint')}>
                    {formatTzBadge(timezone)}
                </span>
                <span className={`ml-auto text-xs ${textMuted}`}>
                    {t('filters.rowCount', { count: kpis?.total_count ?? 0 })}
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

                {/* KPI tiles — window-average per phase, p95 as subtitle */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                    <KpiCard
                        label={t('latencyBreakdown.kpis.agenticAvg')}
                        value={fmtSec(agentic.avg)}
                        valueSize="xl"
                        subtitle={t('latencyBreakdown.kpis.p95Sub', {
                            value: fmtSec(agentic.p95),
                        })}
                        tooltip={t('latencyBreakdown.kpis.agenticInfo')}
                        className="h-full"
                    />
                    <KpiCard
                        label={t('latencyBreakdown.kpis.logicalAvg')}
                        value={fmtSec(logical.avg)}
                        valueSize="xl"
                        subtitle={t('latencyBreakdown.kpis.p95Sub', {
                            value: fmtSec(logical.p95),
                        })}
                        tooltip={t('latencyBreakdown.kpis.logicalInfo')}
                        className="h-full"
                    />
                    <KpiCard
                        label={t('latencyBreakdown.kpis.postWorkAvg')}
                        value={fmtSec(postWork.avg)}
                        valueSize="xl"
                        subtitle={t('latencyBreakdown.kpis.p95Sub', {
                            value: fmtSec(postWork.p95),
                        })}
                        tooltip={t('latencyBreakdown.kpis.postWorkInfo')}
                        className="h-full"
                    />
                </div>

                {/* Per-phase hourly trend (avg / p50 / p95 lines) + that phase's
                    own sample volume (bars, right axis — same 口径 as the metric). */}
                <div className="grid grid-cols-1 gap-2">
                    <MetricWithVolumeCard
                        title={t('latencyBreakdown.charts.agenticTrend')}
                        info={t('latencyBreakdown.charts.secondsAxis')}
                        data={agenticRows}
                        lineSeries={series}
                        volumeKey="count"
                        volumeLabel={t('latencyBreakdown.charts.volumeSeries')}
                        volumeColor={VOLUME_COLOR}
                        height={240}
                        zoomable
                        formatXTick={formatHour}
                        emptyText={t('common.noData')}
                    />
                    <MetricWithVolumeCard
                        title={t('latencyBreakdown.charts.logicalTrend')}
                        info={t('latencyBreakdown.charts.secondsAxis')}
                        data={logicalRows}
                        lineSeries={series}
                        volumeKey="count"
                        volumeLabel={t('latencyBreakdown.charts.volumeSeries')}
                        volumeColor={VOLUME_COLOR}
                        height={240}
                        zoomable
                        formatXTick={formatHour}
                        emptyText={t('common.noData')}
                    />
                    <MetricWithVolumeCard
                        title={t('latencyBreakdown.charts.postWorkTrend')}
                        info={t('latencyBreakdown.charts.secondsAxis')}
                        data={postWorkRows}
                        lineSeries={series}
                        volumeKey="count"
                        volumeLabel={t('latencyBreakdown.charts.volumeSeries')}
                        volumeColor={VOLUME_COLOR}
                        height={240}
                        zoomable
                        formatXTick={formatHour}
                        emptyText={t('common.noData')}
                    />
                </div>
            </div>
        </div>
    )
}
