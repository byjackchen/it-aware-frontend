'use client'

/**
 * Ohla Agent Support — Power BI "Agent Support" page port.
 *
 * Layout (PBIX parity):
 *  - Top left: big Agent Support# KPI tile
 *  - Top right: daily trend line chart
 *  - Bottom: full-width details table
 *
 * Performance: KPI + daily trend come from the server-aggregated
 * /report/ohla-chatbot-agent-support endpoint. The details table calls
 * the existing /interactions list with is_agent_support=true, which
 * typically returns a few hundred rows (vs the legacy 200k-row pull).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, RefreshCw, Headphones } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useOhlaChatbotReport } from '@/lib/hooks/useOhlaChatbotReport'
import { OHLA_PALETTE } from '@/lib/ohla/colors'
import { KpiCard } from '@/components/ops_dashboard/KpiCard'
import { TrendLineCard } from '@/components/ops_dashboard/TrendLineCard'
import { DataTableCard, type Column } from '@/components/ops_dashboard/DataTableCard'
import { useOhlaDateRange } from '@/lib/hooks/useOhlaDateRange'
import { maskWecomId } from '@/lib/ohla/mask'
import { ExpandableText } from '@/components/ohla/ExpandableText'
import type { Interaction } from '@/lib/types/objects'

function fmtNum(n: number): string {
    return n.toLocaleString()
}

function quarterOf(month: number): string {
    return `Qtr ${Math.floor((month - 1) / 3) + 1}`
}

function monthName(m: number): string {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]
}

interface DetailRow {
    year: number
    quarter: string
    month: string
    day: number
    region: string | null
    actorStableId: string
    ticketId: string | null
    ticketReason: string | null
    response: string | null
}

const TICKET_RE = /Ticket\s+(INC\d+)\s+has been created/i

function extractTicketId(interaction: Interaction): string | null {
    // Same priority as the FE decode.ts: record.ticket.id, then regex on response_text.
    const rec = (interaction.content_raw as { record?: { ticket?: { id?: string } } } | null)?.record
    const recTid = rec?.ticket?.id
    if (typeof recTid === 'string' && recTid) return recTid
    const rt = interaction.response_text
    if (typeof rt === 'string') {
        const m = rt.match(TICKET_RE)
        if (m) return m[1]
    }
    return null
}

function extractTicketReason(interaction: Interaction): string | null {
    const rec = (interaction.content_raw as { record?: { ticket?: { reason?: string } } } | null)?.record
    return rec?.ticket?.reason ?? null
}

function toDetailRow(i: Interaction): DetailRow {
    const d = new Date(i.created_at)
    const m = d.getUTCMonth() + 1
    return {
        year: d.getUTCFullYear(),
        quarter: quarterOf(m),
        month: monthName(m),
        day: d.getUTCDate(),
        region: null, // region enrichment dropped — server endpoint owns the chart-side region cut now
        actorStableId: i.actor_stable_id,
        ticketId: extractTicketId(i),
        ticketReason: extractTicketReason(i),
        response: i.response_text ?? null,
    }
}

const ZERO_KPIS = { agent_support_count: 0 } as const

export function AgentSupportDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const { range: { from, to }, setRange } = useOhlaDateRange()

    // KPI + daily trend from the new aggregated endpoint.
    const {
        data: report,
        loading: reportLoading,
        error: reportError,
        refetch: refetchReport,
    } = useOhlaChatbotReport('agent-support', { from, to })

    const block = report?.current
    const kpis = block?.kpis ?? ZERO_KPIS
    const daily = block?.charts.daily_trend ?? []

    // Detail table: small filtered list from /interactions with is_agent_support=true.
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
            params.set('is_agent_support', 'true')
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

    const columns: Column<DetailRow>[] = [
        { key: 'year', label: t('agentSupport.columns.year') },
        { key: 'quarter', label: t('agentSupport.columns.quarter') },
        { key: 'month', label: t('agentSupport.columns.month') },
        { key: 'day', label: t('agentSupport.columns.day'), alignRight: true },
        { key: 'region', label: t('agentSupport.columns.region') },
        { key: 'actorStableId', label: t('agentSupport.columns.wecomId'), render: (r) => maskWecomId(r.actorStableId) },
        { key: 'ticketId', label: t('agentSupport.columns.ticketId') },
        { key: 'ticketReason', label: t('agentSupport.columns.ticketReason'), render: (r) => <ExpandableText text={r.ticketReason} /> },
        { key: 'response', label: t('agentSupport.columns.response'), render: (r) => <ExpandableText text={r.response} /> },
    ]

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
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isLight ? 'bg-sky-100 text-sky-600' : 'bg-sky-500/20 text-sky-400'
                        }`}
                    >
                        <Headphones className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>
                            {t('agentSupport.title')}
                        </h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>
                            {t('agentSupport.subtitle')}
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
                    {t('filters.rowCount', { count: kpis.agent_support_count })}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <KpiCard
                        label={t('agentSupport.kpis.agentSupport')}
                        value={fmtNum(kpis.agent_support_count)}
                        valueSize="xl"
                        tooltip={t('agentSupport.kpis.agentSupportInfo')}
                    />
                    <div className="md:col-span-2">
                        <TrendLineCard
                            title={t('agentSupport.charts.dailyTrend')}
                            data={daily.map((d) => ({ bucket: d.date, count: d.count }))}
                            color={OHLA_PALETTE.agentSupportTrend}
                            height={200}
                            emptyText={t('common.noData')}
                        />
                    </div>
                </div>

                <DataTableCard
                    title={t('agentSupport.charts.details')}
                    rows={detailRowsMapped}
                    columns={columns}
                    totalCount={detailRowsMapped.length}
                    emptyText={t('common.noData')}
                    csvFilename="ohla_agent_support"
                />
            </div>
        </div>
    )
}
