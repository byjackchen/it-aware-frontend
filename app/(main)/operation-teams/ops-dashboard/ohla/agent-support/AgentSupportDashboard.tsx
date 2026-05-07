'use client'

/**
 * Ohla Agent Support — Power BI "Agent Support" page port.
 *
 * Layout (PBIX parity):
 *  - Top left: big Agent Support# KPI tile
 *  - Top right: daily trend line chart
 *  - Bottom: full-width details table (Ticket ID/Reason null on local dump)
 *
 * Agent Support set = queries escalated to a live agent, detected via
 * `primaryResponseTemplate == 'AgentSupportConfirmTemplate'` (see
 * lib/ohla/classify.ts::isAgentSupport).
 */

import { useMemo, useState } from 'react'
import { Clock, RefreshCw, Headphones } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useOhla } from '@/lib/hooks/useOhla'
import {
    computeAgentSupportKpis,
    filterByDateRange,
    groupAgentSupportByDay,
} from '@/lib/ohla/aggregate'
import { isAgentSupport } from '@/lib/ohla/classify'
import { OHLA_PALETTE } from '@/lib/ohla/colors'
import type { OhlaRow } from '@/lib/ohla/types'
import { KpiCard } from '@/components/ops_dashboard/KpiCard'
import { TrendLineCard } from '@/components/ops_dashboard/TrendLineCard'
import { DataTableCard, type Column } from '@/components/ops_dashboard/DataTableCard'
import { useOhlaDateRange } from '@/lib/hooks/useOhlaDateRange'

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

function toDetailRow(r: OhlaRow): DetailRow {
    const d = new Date(r.createdAt)
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    return {
        year: y,
        quarter: quarterOf(m),
        month: monthName(m),
        day: d.getUTCDate(),
        region: r.region,
        actorStableId: r.actorStableId,
        ticketId: r.ticketId,
        ticketReason: r.ticketReason,
        response: r.responseText,
    }
}

export function AgentSupportDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const { range: { from, to }, setRange } = useOhlaDateRange()
    const { rows, loading, error, refetch } = useOhla({ from, to })

    const filtered = useMemo(() => filterByDateRange(rows, from, to), [rows, from, to])
    const kpis = useMemo(() => computeAgentSupportKpis(filtered), [filtered])
    const daily = useMemo(() => groupAgentSupportByDay(filtered), [filtered])
    const detailRows = useMemo(
        () => filtered.filter(isAgentSupport).map(toDetailRow),
        [filtered],
    )

    const columns: Column<DetailRow>[] = [
        { key: 'year', label: t('agentSupport.columns.year') },
        { key: 'quarter', label: t('agentSupport.columns.quarter') },
        { key: 'month', label: t('agentSupport.columns.month') },
        { key: 'day', label: t('agentSupport.columns.day'), alignRight: true },
        { key: 'region', label: t('agentSupport.columns.region') },
        { key: 'actorStableId', label: t('agentSupport.columns.wecomId') },
        { key: 'ticketId', label: t('agentSupport.columns.ticketId') },
        { key: 'ticketReason', label: t('agentSupport.columns.ticketReason') },
        { key: 'response', label: t('agentSupport.columns.response') },
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <KpiCard
                        label={t('agentSupport.kpis.agentSupport')}
                        value={fmtNum(kpis.count)}
                        valueSize="xl"
                    />
                    <div className="md:col-span-2">
                        <TrendLineCard
                            title={t('agentSupport.charts.dailyTrend')}
                            data={daily.map((d) => ({ bucket: d.day, count: d.count }))}
                            color={OHLA_PALETTE.agentSupportTrend}
                            height={200}
                            emptyText={t('common.noData')}
                        />
                    </div>
                </div>

                <DataTableCard
                    title={t('agentSupport.charts.details')}
                    rows={detailRows}
                    columns={columns}
                    totalCount={detailRows.length}
                    emptyText={t('common.noData')}
                />
            </div>
        </div>
    )
}
