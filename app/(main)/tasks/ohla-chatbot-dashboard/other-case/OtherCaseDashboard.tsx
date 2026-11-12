'use client'

/**
 * Ohla Other Case Analysis — Power BI "Other Case Analysis" page port.
 *
 * Performance: KPI + 2 charts come from /dashboards/chatbot/other-case
 * (server-aggregated, 120s Redis cache). The detail table loads small
 * filtered rows from /interactions?ask_classification=other.
 *
 * Layout (PBIX parity):
 *  - Top left: big Other# KPI tile
 *  - Top right: 3-slice pie (Interaction / Irrelevant / unmatched_anywhere)
 *  - Mid: per-day stacked bar of the same 3 categories
 *  - Bottom: details table
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, RefreshCw, Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useOhlaChatbotReport } from '@/lib/hooks/useOhlaChatbotReport'
import { OHLA_PALETTE } from '@/lib/ohla/colors'
import { KpiCard } from '@/components/ops_dashboard/KpiCard'
import { DonutCard } from '@/components/ops_dashboard/DonutCard'
import { StackedBarPercentLineCard } from '@/components/ops_dashboard/StackedBarPercentLineCard'
import { DataTableCard, type Column } from '@/components/ops_dashboard/DataTableCard'
import { useOhlaDateRange } from '@/lib/hooks/useOhlaDateRange'
import { maskWecomId } from '@/lib/ohla/mask'
import { ExpandableText } from '@/components/ohla/ExpandableText'
import type { Interaction } from '@/lib/types/objects'
import { TranslatedAutoRefresh } from '@/components/ops_dashboard/TranslatedAutoRefresh'

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

function toDetailRow(i: Interaction): DetailRow {
    const d = new Date(i.created_at)
    const m = d.getUTCMonth() + 1
    return {
        year: d.getUTCFullYear(),
        quarter: quarterOf(m),
        month: monthName(m),
        day: d.getUTCDate(),
        behaviour: i.action_type,
        userActionCorrected: i.ai_code ?? null,
        actorStableId: i.actor_stable_id,
        userContent: i.content_text ?? null,
        response: i.response_text ?? null,
    }
}

const ZERO_KPIS = { other_count: 0 } as const

export function OtherCaseDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const { range: { from, to }, setRange } = useOhlaDateRange()

    const {
        data: report,
        loading: reportLoading,
        error: reportError,
        refetch: refetchReport,
    } = useOhlaChatbotReport('other-case', { from, to })

    const block = report?.current
    const kpis = block?.kpis ?? ZERO_KPIS
    const distribution = block?.charts.distribution ?? []
    const dailyRows = block?.charts.daily ?? []

    // Detail rows from /interactions?ask_classification=other.
    const [detailRows, setDetailRows] = useState<Interaction[]>([])
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState<string | null>(null)

    const loadDetails = useCallback(async () => {
        if (!from || !to) {
            setDetailRows([])
            return
        }
        setDetailLoading(true)
        setDetailError(null)
        try {
            const params = new URLSearchParams()
            params.set('source_system', 'chatbot')
            params.set('ask_classification', 'other')
            params.set('skip', '0')
            params.set('limit', '1000')
            params.set('sort_by', 'created_at')
            params.set('order', 'desc')
            params.set('created_at_from', `${from}T00:00:00.000Z`)
            params.set('created_at_to', `${to}T23:59:59.999Z`)
            const resp = await fetch(`/api/objects/interactions?${params.toString()}`, { cache: 'no-store' })
            if (!resp.ok) throw new Error(`Detail fetch failed: ${resp.status}`)
            const env = (await resp.json()) as { items?: Interaction[] }
            setDetailRows(env.items ?? [])
        } catch (err) {
            setDetailError(err instanceof Error ? err.message : String(err))
            setDetailRows([])
        } finally {
            setDetailLoading(false)
        }
    }, [from, to])

    useEffect(() => {
        void loadDetails()
    }, [loadDetails])

    const refetch = useCallback(async () => {
        await Promise.all([refetchReport(), loadDetails()])
    }, [refetchReport, loadDetails])

    const detailRowsMapped = useMemo(() => detailRows.map(toDetailRow), [detailRows])
    const loading = reportLoading || detailLoading
    const error = reportError ?? detailError

    // Slice color/label mapping by bucket (BE returns 'interaction' / 'irrelevant' / 'unmatched_anywhere').
    const COLOR_BY_BUCKET: Record<string, string> = {
        interaction: OHLA_PALETTE.interaction,
        irrelevant: OHLA_PALETTE.irrelevant,
        unmatched_anywhere: OHLA_PALETTE.unmatchedAnywhere,
    }
    const LABEL_KEY_BY_BUCKET: Record<string, string> = {
        interaction: 'otherCase.categories.interaction',
        irrelevant: 'otherCase.categories.irrelevant',
        unmatched_anywhere: 'otherCase.categories.unmatchedAnywhere',
    }

    const slices = useMemo(
        () =>
            distribution.map((b) => ({
                name: t(LABEL_KEY_BY_BUCKET[b.bucket] ?? b.bucket),
                value: b.count,
                color: COLOR_BY_BUCKET[b.bucket],
            })),
        [distribution, t],
    )

    const columns: Column<DetailRow>[] = [
        { key: 'year', label: t('otherCase.columns.year') },
        { key: 'quarter', label: t('otherCase.columns.quarter') },
        { key: 'month', label: t('otherCase.columns.month') },
        { key: 'day', label: t('otherCase.columns.day'), alignRight: true },
        { key: 'behaviour', label: t('otherCase.columns.behaviour') },
        { key: 'userActionCorrected', label: t('otherCase.columns.userActionCorrected') },
        { key: 'actorStableId', label: t('otherCase.columns.wecomId'), render: (r) => maskWecomId(r.actorStableId) },
        { key: 'userContent', label: t('otherCase.columns.userContent'), render: (r) => <ExpandableText text={r.userContent} /> },
        { key: 'response', label: t('otherCase.columns.response'), render: (r) => <ExpandableText text={r.response} /> },
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
                <div className="flex items-center gap-2">
                    <TranslatedAutoRefresh onRefresh={() => void refetch()} storageKey="ops-dashboard:ohla-other-case:auto-refresh" />
                    <button
                    onClick={() => void refetch()}
                    className={`p-2 rounded-lg border transition-colors ${chipBtn}`}
                    title={t('common.refresh')}
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                </div>
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
                    {t('filters.rowCount', { count: kpis.other_count })}
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
                    <KpiCard
                        label={t('otherCase.kpis.other')}
                        value={fmtNum(kpis.other_count)}
                        valueSize="xl"
                        tooltip={t('otherCase.kpis.otherInfo')}
                    />
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
                        data={dailyRows.map((d) => ({
                            day: d.date,
                            interaction: d.interaction,
                            irrelevant: d.irrelevant,
                            unmatched_anywhere: d.unmatched_anywhere,
                        }))}
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
                    rows={detailRowsMapped}
                    columns={columns}
                    totalCount={detailRowsMapped.length}
                    emptyText={t('common.noData')}
                    csvFilename="ohla_other_case"
                />
            </div>
        </div>
    )
}
