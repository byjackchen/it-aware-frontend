'use client'

/**
 * Ohla Overview — Power BI "Overview" page port.
 *
 * Performance: KPIs and charts come from the server-aggregated
 * /report/ohla-chatbot-overview endpoint by default (one small payload,
 * 120s Redis-cached). The legacy 200k-row /interactions pull only
 * happens lazily when the user engages a cross-filter (donut click),
 * because the report endpoint doesn't support per-facet filters.
 *
 * 17 visuals from the PBIX:
 *  - 1 textbox header (rendered inline as subtitle)
 *  - 1 global date slicer driving every other visual on the page
 *  - 9 KPI cards: total interactions, distinct users, Tier 0 Supported,
 *    FAQ Match Rate, Overall Match Rate, Avg Survey Rate, Total Action
 *    Chain, Non-Auto Support, DataLagDays
 *  - 3 donut charts: Business Group / Region / User Action
 *  - 2 line charts: daily chat volume trend + active users trend
 *  - 1 line+stacked-column combo: behaviour mix by month
 */

import { useCallback, useMemo, useState } from 'react'
import {
    Sparkles,
    Users,
    MessagesSquare,
    MousePointerClick,
    ShieldCheck,
    Stars,
    HelpCircle,
    Headphones,
    ClipboardList,
    Clock,
    RefreshCw,
    X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useOhla } from '@/lib/hooks/useOhla'
import { useOhlaChatbotReport } from '@/lib/hooks/useOhlaChatbotReport'
import {
    computeKpis,
    countBy,
    filterByDateRange,
    groupAutoVsAskByMonth,
    topN,
} from '@/lib/ohla/aggregate'
import type { OhlaRow } from '@/lib/ohla/types'
import { KpiCard } from '@/components/ops_dashboard/KpiCard'
import { DonutCard } from '@/components/ops_dashboard/DonutCard'
import { TrendLineCard } from '@/components/ops_dashboard/TrendLineCard'
import { StackedBarPercentLineCard } from '@/components/ops_dashboard/StackedBarPercentLineCard'
import { useOhlaDateRange } from '@/lib/hooks/useOhlaDateRange'

function fmtNum(n: number): string {
    return n.toLocaleString()
}

function fmtSurveyRate(v: number | null): string {
    if (v === null) return '—'
    return v.toFixed(2)
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
] as const

function monthLabel(month: string): string {
    const idx = parseInt(month.slice(5, 7), 10) - 1
    return MONTH_NAMES[idx] ?? month
}

function quarterLabel(month: string): string {
    const idx = parseInt(month.slice(5, 7), 10) - 1
    return `Qtr ${Math.floor(idx / 3) + 1}`
}

export function OhlaOverviewDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const { range: { from, to }, setRange } = useOhlaDateRange()

    // Cross-filter state — each donut slice click toggles membership in the
    // matching selection set. Multiple picks within a donut are OR; different
    // donuts combine with AND ("Region=APAC" AND "BG=CSIG"). Empty set = no
    // filter for that facet. Matches the PBI cross-filter semantics.
    const [bgSel, setBgSel] = useState<string[]>([])
    const [regionSel, setRegionSel] = useState<string[]>([])
    const [behaviourSel, setBehaviourSel] = useState<string[]>([])

    const hasCrossFilter =
        bgSel.length > 0 || regionSel.length > 0 || behaviourSel.length > 0

    // Fast path: server-aggregated report (no row pull, 120s Redis cache).
    const {
        data: reportData,
        loading: reportLoading,
        error: reportError,
        refetch: refetchReport,
    } = useOhlaChatbotReport('overview', { from, to })

    // Lazy path: only spin up the heavy /interactions row pull when the user
    // actually engages cross-filter. computeKpis + countBy then run on rows.
    const {
        rows,
        loading: rowsLoading,
        error: rowsError,
        refetch: refetchRows,
    } = useOhla({ from, to, enabled: hasCrossFilter })

    const loading = hasCrossFilter ? rowsLoading : reportLoading
    const error = hasCrossFilter ? rowsError : reportError
    const refetch = useCallback(async () => {
        if (hasCrossFilter) await refetchRows()
        else await refetchReport()
    }, [hasCrossFilter, refetchRows, refetchReport])

    const toggle = useCallback(
        (setter: React.Dispatch<React.SetStateAction<string[]>>) =>
            (name: string) =>
                setter((prev) =>
                    prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
                ),
        [],
    )

    const clearAllFilters = useCallback(() => {
        setBgSel([])
        setRegionSel([])
        setBehaviourSel([])
    }, [])

    const dateFiltered: OhlaRow[] = useMemo(
        () => filterByDateRange(rows, from, to),
        [rows, from, to],
    )

    const applyCrossFilter = useCallback(
        (
            base: OhlaRow[],
            exclude?: 'bg' | 'region' | 'behaviour',
        ): OhlaRow[] => {
            return base.filter((r) => {
                if (exclude !== 'bg' && bgSel.length > 0) {
                    if (r.businessGroup === null || !bgSel.includes(r.businessGroup)) return false
                }
                if (exclude !== 'region' && regionSel.length > 0) {
                    if (r.region === null || !regionSel.includes(r.region)) return false
                }
                if (exclude !== 'behaviour' && behaviourSel.length > 0) {
                    if (!behaviourSel.includes(r.behaviour)) return false
                }
                return true
            })
        },
        [bgSel, regionSel, behaviourSel],
    )

    const filtered: OhlaRow[] = useMemo(
        () => applyCrossFilter(dateFiltered),
        [dateFiltered, applyCrossFilter],
    )

    // ── KPI + chart data sources ────────────────────────────────────────────
    // When NOT cross-filtered: read straight from the server report payload.
    // When cross-filtered: fall back to client-side compute over rows.

    const block = reportData?.current

    const kpis = useMemo(() => {
        if (hasCrossFilter) {
            const k = computeKpis(filtered, new Date())
            return {
                totalInteractions: k.totalInteractions,
                queryCount: k.queryCount,
                totalActionChain: k.totalActionChain,
                distinctUsers: k.distinctUsers,
                tier0Supported: k.tier0Supported,
                liveAgentSupport: k.liveAgentSupport,
                userSurvey: k.userSurvey,
                avgSurveyRate: k.avgSurveyRate,
            }
        }
        if (!block) {
            return {
                totalInteractions: 0,
                queryCount: 0,
                totalActionChain: 0,
                distinctUsers: 0,
                tier0Supported: 0,
                liveAgentSupport: 0,
                userSurvey: 0,
                avgSurveyRate: null as number | null,
            }
        }
        return {
            totalInteractions: block.kpis.total_interactions,
            queryCount: block.kpis.user_ask_count,
            totalActionChain: block.kpis.total_action_chain,
            distinctUsers: block.kpis.distinct_users,
            tier0Supported: block.kpis.tier0_supported,
            liveAgentSupport: block.kpis.live_agent_support_count,
            userSurvey: block.kpis.user_survey_count,
            avgSurveyRate: block.kpis.avg_survey_rate,
        }
    }, [hasCrossFilter, filtered, block])

    // Donuts: server payload preferred; cross-filter mode rebuilds locally.
    const bgSlices = useMemo(() => {
        if (hasCrossFilter) {
            const base = applyCrossFilter(dateFiltered, 'bg')
            return topN(countBy(base, (r) => r.businessGroup), 8)
        }
        return (block?.charts.by_business_group ?? []).map((s) => ({ name: s.label, value: s.count }))
    }, [hasCrossFilter, dateFiltered, applyCrossFilter, block])

    const behaviourSlices = useMemo(() => {
        if (hasCrossFilter) {
            const base = applyCrossFilter(dateFiltered, 'behaviour')
            return topN(countBy(base, (r) => r.behaviour), 4)
        }
        return (block?.charts.by_action ?? []).map((s) => ({ name: s.label, value: s.count }))
    }, [hasCrossFilter, dateFiltered, applyCrossFilter, block])

    const regionSlices = useMemo(() => {
        if (hasCrossFilter) {
            const base = applyCrossFilter(dateFiltered, 'region')
            return topN(countBy(base, (r) => r.region), 6)
        }
        return (block?.charts.by_region ?? []).map((s) => ({ name: s.label, value: s.count }))
    }, [hasCrossFilter, dateFiltered, applyCrossFilter, block])

    const volumeSeries = useMemo(() => {
        if (hasCrossFilter) {
            const map = new Map<string, number>()
            for (const r of filtered) {
                map.set(r.createdDate, (map.get(r.createdDate) ?? 0) + 1)
            }
            return [...map.entries()]
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([day, count]) => ({ bucket: day, count }))
        }
        return (block?.charts.page_views_daily ?? []).map((p) => ({
            bucket: p.date, count: p.count,
        }))
    }, [hasCrossFilter, filtered, block])

    const distinctUserSeries = useMemo(() => {
        if (hasCrossFilter) {
            const bucket = new Map<string, Set<string>>()
            for (const r of filtered) {
                if (!bucket.has(r.createdDate)) bucket.set(r.createdDate, new Set())
                bucket.get(r.createdDate)!.add(r.actorStableId)
            }
            return [...bucket.entries()]
                .map(([day, users]) => ({ bucket: day, count: users.size }))
                .sort((a, b) => a.bucket.localeCompare(b.bucket))
        }
        return (block?.charts.unique_visitors_daily ?? []).map((p) => ({
            bucket: p.date, count: p.distinct_users,
        }))
    }, [hasCrossFilter, filtered, block])

    const autoVsAskMonthly = useMemo(() => {
        if (hasCrossFilter) {
            return groupAutoVsAskByMonth(filtered)
        }
        return (block?.charts.auto_vs_total_monthly ?? []).map((m) => ({
            month: m.month,
            monthLabel: monthLabel(m.month),
            quarterLabel: quarterLabel(m.month),
            autoSupport: m.auto_support,
            liveAgentSupport: m.live_agent_support,
            autoRate: m.auto_rate,
        }))
    }, [hasCrossFilter, filtered, block])

    const visibleRowCount = hasCrossFilter
        ? filtered.length
        : kpis.totalInteractions

    const bg = isLight ? 'bg-slate-50' : 'bg-slate-900'
    const textMain = isLight ? 'text-slate-900' : 'text-gray-100'
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400'
    const chipBtn = isLight
        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
        : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'

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
                            {t('overview.title')}
                        </h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>
                            {t('overview.subtitle')}
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
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm shrink-0 ${
                    isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'
                }`}
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
                    {t('filters.rowCount', { count: visibleRowCount })}
                </span>
            </div>

            {/* Scrollable main content */}
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

                {hasCrossFilter && (
                    <div
                        className={`flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2 mb-3 text-xs ${
                            isLight
                                ? 'bg-white border-slate-200'
                                : 'bg-white/5 border-white/10'
                        }`}
                    >
                        <span className={textMuted}>{t('filters.active')}</span>
                        {bgSel.map((name) => (
                            <FilterChip
                                key={`bg-${name}`}
                                isLight={isLight}
                                label={`${t('charts.businessGroup')}: ${name}`}
                                color="#3b82f6"
                                onClear={() => toggle(setBgSel)(name)}
                            />
                        ))}
                        {regionSel.map((name) => (
                            <FilterChip
                                key={`region-${name}`}
                                isLight={isLight}
                                label={`${t('charts.region')}: ${name}`}
                                color="#22c55e"
                                onClear={() => toggle(setRegionSel)(name)}
                            />
                        ))}
                        {behaviourSel.map((name) => (
                            <FilterChip
                                key={`beh-${name}`}
                                isLight={isLight}
                                label={`${t('charts.behaviour')}: ${name}`}
                                color="#f59e0b"
                                onClear={() => toggle(setBehaviourSel)(name)}
                            />
                        ))}
                        <button
                            onClick={clearAllFilters}
                            className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${
                                isLight
                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                    : 'bg-white/10 hover:bg-white/20 text-gray-200'
                            }`}
                        >
                            {t('filters.clearAll')}
                        </button>
                    </div>
                )}

                {/* Row 1 — 3 headline KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1 mb-1">
                    <KpiCard
                        label={t('kpis.totalInteractions')}
                        value={fmtNum(kpis.totalInteractions)}
                        icon={MessagesSquare}
                        tooltip={t('kpis.totalInteractionsInfo')}
                    />
                    <KpiCard
                        label={t('kpis.userAsk')}
                        value={fmtNum(kpis.queryCount)}
                        icon={HelpCircle}
                        tooltip={t('kpis.userAskInfo')}
                    />
                    <KpiCard
                        label={t('kpis.totalActionChain')}
                        value={fmtNum(kpis.totalActionChain)}
                        icon={MousePointerClick}
                        tooltip={t('kpis.totalActionChainInfo')}
                    />
                </div>

                {/* Row 2 — 5 secondary KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-1 mb-1">
                    <KpiCard
                        label={t('kpis.distinctUsers')}
                        value={fmtNum(kpis.distinctUsers)}
                        icon={Users}
                        tooltip={t('kpis.distinctUsersInfo')}
                    />
                    <KpiCard
                        label={t('kpis.tier0Supported')}
                        value={fmtNum(kpis.tier0Supported)}
                        icon={ShieldCheck}
                        tooltip={t('kpis.tier0SupportedInfo')}
                    />
                    <KpiCard
                        label={t('kpis.nonAutoSupport')}
                        value={fmtNum(kpis.liveAgentSupport)}
                        icon={Headphones}
                        tooltip={t('kpis.nonAutoSupportInfo')}
                    />
                    <KpiCard
                        label={t('kpis.userSurvey')}
                        value={fmtNum(kpis.userSurvey)}
                        icon={ClipboardList}
                        tooltip={t('kpis.userSurveyInfo')}
                    />
                    <KpiCard
                        label={t('kpis.avgSurveyRate')}
                        value={fmtSurveyRate(kpis.avgSurveyRate)}
                        icon={Stars}
                        tooltip={t('kpis.avgSurveyRateInfo')}
                    />
                </div>

                {/* Row 3 — donuts + line trends */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-1 mb-1">
                    <div className="md:col-span-5">
                        <DonutCard
                            title={t('charts.businessGroup')}
                            data={bgSlices}
                            height={432}
                            emptyText={t('common.noData')}
                            selectedSlices={bgSel}
                            onLegendToggle={toggle(setBgSel)}
                            onSliceClick={(s) => toggle(setBgSel)(s.name)}
                        />
                    </div>
                    <div className="md:col-span-3 flex flex-col gap-1">
                        <DonutCard
                            title={t('charts.behaviour')}
                            data={behaviourSlices}
                            height={178}
                            emptyText={t('common.noData')}
                            selectedSlices={behaviourSel}
                            onLegendToggle={toggle(setBehaviourSel)}
                            onSliceClick={(s) => toggle(setBehaviourSel)(s.name)}
                        />
                        <DonutCard
                            title={t('charts.region')}
                            data={regionSlices}
                            height={178}
                            emptyText={t('common.noData')}
                            selectedSlices={regionSel}
                            onLegendToggle={toggle(setRegionSel)}
                            onSliceClick={(s) => toggle(setRegionSel)(s.name)}
                        />
                    </div>
                    <div className="md:col-span-4 flex flex-col gap-1">
                        <TrendLineCard
                            title={t('charts.volumeTrend')}
                            data={volumeSeries}
                            height={178}
                            color="#6366f1"
                            emptyText={t('common.noData')}
                            zoomable
                        />
                        <TrendLineCard
                            title={t('charts.distinctUserTrend')}
                            data={distinctUserSeries}
                            height={178}
                            color="#14b8a6"
                            emptyText={t('common.noData')}
                            zoomable
                        />
                    </div>
                </div>

                {/* Row 4 — Auto Support vs Total Ask */}
                <div className="mb-1">
                    <StackedBarPercentLineCard
                        title={t('charts.behaviourTrend')}
                        data={autoVsAskMonthly.map((m) => ({ ...m }))}
                        xKey="monthLabel"
                        secondaryXKey="quarterLabel"
                        height={300}
                        emptyText={t('common.noData')}
                        showBarLabels
                        showLineLabels
                        stackedKeys={[
                            { key: 'autoSupport', label: t('kpis.tier0Supported'), color: '#1e3a8a' },
                            { key: 'liveAgentSupport', label: t('kpis.nonAutoSupport'), color: '#38bdf8' },
                        ]}
                        lineKeys={[
                            { key: 'autoRate', label: t('charts.autoRate'), color: '#f97316' },
                        ]}
                    />
                </div>
            </div>
        </div>
    )
}

/** Compact filter chip shown in the active-filters bar. */
function FilterChip({
    label,
    color,
    onClear,
    isLight,
}: {
    label: string
    color: string
    onClear: () => void
    isLight: boolean
}) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
                isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-700'
                    : 'bg-white/10 border-white/10 text-gray-100'
            }`}
        >
            <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
            />
            <span className="text-[11px]">{label}</span>
            <button
                type="button"
                onClick={onClear}
                className={`ml-0.5 p-0.5 rounded hover:opacity-80 ${
                    isLight ? 'text-slate-500' : 'text-gray-400'
                }`}
                aria-label="remove filter"
            >
                <X className="w-3 h-3" />
            </button>
        </span>
    )
}
