'use client'

/**
 * Ohla Overview — Power BI "Overview" page port.
 *
 * Source of truth: Ohla_Chat_History_Zach_2 table in the Power BI report,
 * backed locally by activities.interactions rows where
 * source_system = 'chatbot' enriched with worker-hierarchy metadata
 * (region, country, VIP, business group) from /objects/workers.
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
 *
 * Data loading: `useOhla({from, to})` hook does a single parallel fetch of
 * all Ohla interactions within the window + the full active worker list
 * for enrichment. Switching slicer dates re-requests only when the bounds
 * materially change; in-memory cache keeps sibling Ohla pages snappy.
 */

import { useCallback, useMemo, useState } from 'react'
import {
    Sparkles,
    Users,
    MessagesSquare,
    TrendingUp,
    ShieldCheck,
    FileCheck2,
    Percent,
    Stars,
    ListChecks,
    Headphones,
    Clock,
    RefreshCw,
    X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useOhla } from '@/lib/hooks/useOhla'
import {
    computeKpis,
    countBy,
    filterByDateRange,
    groupByMonth,
    topN,
} from '@/lib/ohla/aggregate'
import type { OhlaRow } from '@/lib/ohla/types'
import { KpiCard } from '@/components/ops_dashboard/KpiCard'
import { DonutCard } from '@/components/ops_dashboard/DonutCard'
import { TrendLineCard } from '@/components/ops_dashboard/TrendLineCard'

/** Default window: trailing 90 days, matching the other Ops dashboards. */
function defaultDateRange(): { from: string; to: string } {
    const now = new Date()
    const to = now.toISOString().slice(0, 10)
    const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10)
    return { from, to }
}

function pct(v: number, digits = 1): string {
    return `${(v * 100).toFixed(digits)}%`
}

function fmtNum(n: number): string {
    return n.toLocaleString()
}

function fmtSurveyRate(v: number | null): string {
    if (v === null) return '—'
    return v.toFixed(2)
}

export function OhlaOverviewDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const [{ from, to }, setRange] = useState(defaultDateRange)
    const { rows, loading, error, refetch } = useOhla({ from, to })

    // Cross-filter state — each donut slice click toggles membership in the
    // matching selection set. Multiple picks within a donut are OR; different
    // donuts combine with AND ("Region=APAC" AND "BG=CSIG"). Empty set = no
    // filter for that facet. Matches the PBI cross-filter semantics.
    const [bgSel, setBgSel] = useState<string[]>([])
    const [regionSel, setRegionSel] = useState<string[]>([])
    const [behaviourSel, setBehaviourSel] = useState<string[]>([])

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

    // Defensive: while the hook is loading the cached/stale rows stay
    // visible, but we still want filterByDateRange to work on the current
    // `from/to` so we re-filter on the client — the server call may have
    // returned a wider window because the user only nudged a boundary.
    const dateFiltered: OhlaRow[] = useMemo(
        () => filterByDateRange(rows, from, to),
        [rows, from, to],
    )

    /**
     * Apply cross-filter facets. `exclude` lets each donut compute its own
     * slice data ignoring its own selection — otherwise picking a BG slice
     * would collapse the BG donut to a single wedge. PBI does the same.
     */
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

    /** Fully cross-filtered set — powers KPIs, line charts, and combo. */
    const filtered: OhlaRow[] = useMemo(
        () => applyCrossFilter(dateFiltered),
        [dateFiltered, applyCrossFilter],
    )

    /** Per-donut data excludes that donut's own facet so the user can see
     * the full distribution along the axis they're currently selecting. */
    const bgBase = useMemo(() => applyCrossFilter(dateFiltered, 'bg'), [dateFiltered, applyCrossFilter])
    const regionBase = useMemo(
        () => applyCrossFilter(dateFiltered, 'region'),
        [dateFiltered, applyCrossFilter],
    )
    const behaviourBase = useMemo(
        () => applyCrossFilter(dateFiltered, 'behaviour'),
        [dateFiltered, applyCrossFilter],
    )

    const kpis = useMemo(() => computeKpis(filtered, new Date()), [filtered])

    const behaviourSlices = useMemo(
        () => topN(countBy(behaviourBase, (r) => r.behaviour), 4),
        [behaviourBase],
    )

    const regionSlices = useMemo(
        () => topN(countBy(regionBase, (r) => r.region), 6),
        [regionBase],
    )

    const bgSlices = useMemo(
        () => topN(countBy(bgBase, (r) => r.businessGroup), 8),
        [bgBase],
    )

    const monthly = useMemo(() => groupByMonth(filtered), [filtered])

    /** Single-series count-per-month for the daily volume line chart. */
    const volumeSeries = useMemo(
        () => monthly.map((m) => ({ bucket: `${m.month}-01`, count: m.total })),
        [monthly],
    )

    /** Distinct-user-per-month proxy: count of unique actor_stable_ids. */
    const distinctUserSeries = useMemo(() => {
        const bucket = new Map<string, Set<string>>()
        for (const r of filtered) {
            const month = r.createdDate.slice(0, 7)
            if (!bucket.has(month)) bucket.set(month, new Set())
            bucket.get(month)!.add(r.actorStableId)
        }
        return [...bucket.entries()]
            .map(([month, users]) => ({ bucket: `${month}-01`, count: users.size }))
            .sort((a, b) => a.bucket.localeCompare(b.bucket))
    }, [filtered])

    /** Multi-series combo (behaviour mix). */
    const behaviourTrend = useMemo(
        () =>
            monthly.map((m) => ({
                bucket: `${m.month}-01`,
                enter_chat: m.byBehaviour.enter_chat ?? 0,
                query: m.byBehaviour.query ?? 0,
                click: m.byBehaviour.click ?? 0,
            })),
        [monthly],
    )

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
                    {t('filters.rowCount', { count: filtered.length })}
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

                {/* Active cross-filter chips — mirrors the donut selection
                 *  state. Each chip removes one slice from its facet; the
                 *  "Clear all" pill on the right nukes every facet at once.
                 */}
                {(bgSel.length > 0 || regionSel.length > 0 || behaviourSel.length > 0) && (
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

                {/* Row 1 — 5 headline KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
                    <KpiCard
                        label={t('kpis.totalInteractions')}
                        value={fmtNum(kpis.totalInteractions)}
                        icon={MessagesSquare}
                    />
                    <KpiCard
                        label={t('kpis.distinctUsers')}
                        value={fmtNum(kpis.distinctUsers)}
                        icon={Users}
                    />
                    <KpiCard
                        label={t('kpis.tier0Supported')}
                        value={pct(kpis.tier0Supported)}
                        icon={ShieldCheck}
                    />
                    <KpiCard
                        label={t('kpis.faqMatchRate')}
                        value={pct(kpis.faqMatchRate)}
                        icon={FileCheck2}
                    />
                    <KpiCard
                        label={t('kpis.overallMatchRate')}
                        value={pct(kpis.overallMatchRate)}
                        icon={Percent}
                    />
                </div>

                {/* Row 2 — 4 secondary KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                    <KpiCard
                        label={t('kpis.avgSurveyRate')}
                        value={fmtSurveyRate(kpis.avgSurveyRate)}
                        subtitle={t('kpis.avgSurveyRateHint')}
                        icon={Stars}
                    />
                    <KpiCard
                        label={t('kpis.totalActionChain')}
                        value={fmtNum(kpis.totalActionChain)}
                        icon={ListChecks}
                    />
                    <KpiCard
                        label={t('kpis.nonAutoSupport')}
                        value={fmtNum(kpis.nonAutoSupport)}
                        icon={Headphones}
                    />
                    <KpiCard
                        label={t('kpis.dataLagDays')}
                        value={kpis.dataLagDays === null ? '—' : String(kpis.dataLagDays)}
                        subtitle={
                            kpis.latestAt
                                ? t('kpis.dataLagDaysHint', { date: kpis.latestAt.slice(0, 10) })
                                : undefined
                        }
                        icon={Clock}
                    />
                </div>

                {/* Row 3 — 3 donuts */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <DonutCard
                        title={t('charts.businessGroup')}
                        data={bgSlices}
                        height={220}
                        emptyText={t('common.noData')}
                        selectedSlices={bgSel}
                        onLegendToggle={toggle(setBgSel)}
                        onSliceClick={(s) => toggle(setBgSel)(s.name)}
                    />
                    <DonutCard
                        title={t('charts.region')}
                        data={regionSlices}
                        height={220}
                        emptyText={t('common.noData')}
                        selectedSlices={regionSel}
                        onLegendToggle={toggle(setRegionSel)}
                        onSliceClick={(s) => toggle(setRegionSel)(s.name)}
                    />
                    <DonutCard
                        title={t('charts.behaviour')}
                        data={behaviourSlices}
                        height={220}
                        emptyText={t('common.noData')}
                        selectedSlices={behaviourSel}
                        onLegendToggle={toggle(setBehaviourSel)}
                        onSliceClick={(s) => toggle(setBehaviourSel)(s.name)}
                    />
                </div>

                {/* Row 4 — combo (behaviour mix) */}
                <div className="mb-3">
                    <TrendLineCard
                        title={t('charts.behaviourTrend')}
                        subtitle={t('charts.behaviourTrendSubtitle')}
                        data={behaviourTrend}
                        height={260}
                        series={[
                            { key: 'enter_chat', label: t('behaviour.enter_chat'), color: '#3b82f6' },
                            { key: 'query', label: t('behaviour.query'), color: '#22c55e' },
                            { key: 'click', label: t('behaviour.click'), color: '#f59e0b' },
                        ]}
                        emptyText={t('common.noData')}
                    />
                </div>

                {/* Row 5 — 2 line charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <TrendLineCard
                        title={t('charts.volumeTrend')}
                        subtitle={t('charts.volumeTrendSubtitle')}
                        data={volumeSeries}
                        height={220}
                        color="#6366f1"
                        emptyText={t('common.noData')}
                    />
                    <TrendLineCard
                        title={t('charts.distinctUserTrend')}
                        subtitle={t('charts.distinctUserTrendSubtitle')}
                        data={distinctUserSeries}
                        height={220}
                        color="#14b8a6"
                        emptyText={t('common.noData')}
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
