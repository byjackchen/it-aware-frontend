'use client'

/**
 * Ohla Survey Details — Power BI "Survey Details" page port.
 *
 * Layout (PBIX parity):
 *  - Top row: Survey# KPI tile + 4 filter controls + date pickers
 *  - Body: full-width Survey Details table
 *
 * PBIX "Survey Received? = Yes" is detected as:
 *   action_type='click' AND request_action='actionchain-rateticket-naive'
 * The rating is embedded in content_text as "…-{rate}|{hash}" (1-5).
 *
 * Filters:
 *   VIP Filter (All/true/false) — from worker.is_vip
 *   Business Group Filter (All + enumerated from data)
 *   CountryFilter (All + enumerated)
 *   Survey Rate range 1-5 inclusive
 *   Date/Time from/to
 */

import { useMemo, useState } from 'react'
import { Clock, RefreshCw, ClipboardSignature } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useOhla } from '@/lib/hooks/useOhla'
import { computeSurveyKpis, filterByDateRange } from '@/lib/ohla/aggregate'
import { OHLA_PALETTE } from '@/lib/ohla/colors'
import type { OhlaRow } from '@/lib/ohla/types'
import { KpiCard } from '@/components/ops_dashboard/KpiCard'
import { DataTableCard, type Column } from '@/components/ops_dashboard/DataTableCard'
import { RangeSliderFilter } from '@/components/ohla/RangeSliderFilter'
import { useOhlaDateRange } from '@/lib/hooks/useOhlaDateRange'
import { maskWecomId } from '@/lib/ohla/mask'
import { ExpandableText } from '@/components/ohla/ExpandableText'

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
    region: string | null
    actorStableId: string
    userContent: string | null
    surveyRate: number | null
    userContent2: string | null // PBIX duplicates User Content as rightmost column
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
        userContent: r.userContent,
        surveyRate: r.surveyRate,
        userContent2: r.userContent,
    }
}

type VipFilter = 'all' | 'vip' | 'non-vip'

export function SurveyDetailsDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const { range: { from, to }, setRange } = useOhlaDateRange()
    const [vipFilter, setVipFilter] = useState<VipFilter>('all')
    const [bgFilter, setBgFilter] = useState<string>('all')
    const [countryFilter, setCountryFilter] = useState<string>('all')
    const [rateRange, setRateRange] = useState<[number, number]>([1, 5])
    const { rows, loading, error, refetch } = useOhla({ from, to })

    const dateFiltered = useMemo(() => filterByDateRange(rows, from, to), [rows, from, to])
    const surveyRows = useMemo(
        () => dateFiltered.filter((r) => r.surveyReceived),
        [dateFiltered],
    )

    // Enumerate BG / Country options from the full survey set (not yet filtered).
    const bgOptions = useMemo(() => {
        const set = new Set<string>()
        for (const r of surveyRows) if (r.businessGroup) set.add(r.businessGroup)
        return Array.from(set).sort()
    }, [surveyRows])
    const countryOptions = useMemo(() => {
        const set = new Set<string>()
        for (const r of surveyRows) if (r.country) set.add(r.country)
        return Array.from(set).sort()
    }, [surveyRows])

    // Apply remaining filters (VIP / BG / Country / Rate).
    const filtered = useMemo(() => {
        return surveyRows.filter((r) => {
            if (vipFilter === 'vip' && !r.isVip) return false
            if (vipFilter === 'non-vip' && r.isVip) return false
            if (bgFilter !== 'all' && r.businessGroup !== bgFilter) return false
            if (countryFilter !== 'all' && r.country !== countryFilter) return false
            if (typeof r.surveyRate === 'number') {
                if (r.surveyRate < rateRange[0] || r.surveyRate > rateRange[1]) return false
            }
            return true
        })
    }, [surveyRows, vipFilter, bgFilter, countryFilter, rateRange])

    const kpis = useMemo(() => computeSurveyKpis(filtered), [filtered])
    const detailRows = useMemo(() => filtered.map(toDetailRow), [filtered])

    const columns: Column<DetailRow>[] = [
        { key: 'year', label: t('surveyDetails.columns.year') },
        { key: 'quarter', label: t('surveyDetails.columns.quarter') },
        { key: 'month', label: t('surveyDetails.columns.month') },
        { key: 'day', label: t('surveyDetails.columns.day'), alignRight: true },
        { key: 'region', label: t('surveyDetails.columns.region') },
        { key: 'actorStableId', label: t('surveyDetails.columns.wecomId'), render: (r) => maskWecomId(r.actorStableId) },
        { key: 'userContent', label: t('surveyDetails.columns.userContent'), render: (r) => <ExpandableText text={r.userContent} /> },
        {
            key: 'surveyRate',
            label: t('surveyDetails.columns.surveyRate'),
            alignRight: true,
            render: (r) => (typeof r.surveyRate === 'number' ? r.surveyRate.toFixed(2) : '—'),
        },
        { key: 'userContent2', label: t('surveyDetails.columns.userContent'), render: (r) => <ExpandableText text={r.userContent2} /> },
    ]

    const bg = isLight ? 'bg-slate-50' : 'bg-slate-900'
    const textMain = isLight ? 'text-slate-900' : 'text-gray-100'
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400'
    const chipBtn = isLight
        ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
        : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
    const mutedCardCls = isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'
    const inputCls = isLight
        ? 'bg-white border-slate-200 text-slate-800'
        : 'bg-slate-900 border-white/10 text-gray-100'

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] overflow-hidden p-4 gap-3 ${bg}`}>
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isLight
                                ? 'bg-emerald-100 text-emerald-600'
                                : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                    >
                        <ClipboardSignature className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>
                            {t('surveyDetails.title')}
                        </h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>
                            {t('surveyDetails.subtitle')}
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

            {/* Filter row (horizontal) */}
            <div
                className={`flex flex-wrap items-center gap-4 rounded-xl border px-3 py-2 text-sm shrink-0 ${mutedCardCls}`}
            >
                <label className="flex items-center gap-2">
                    <span className={textMuted}>{t('surveyDetails.filters.vip')}</span>
                    <select
                        value={vipFilter}
                        onChange={(e) => setVipFilter(e.target.value as VipFilter)}
                        className={`px-2 py-1 rounded border text-xs ${inputCls}`}
                    >
                        <option value="all">{t('common.all')}</option>
                        <option value="vip">{t('surveyDetails.filters.vipYes')}</option>
                        <option value="non-vip">{t('surveyDetails.filters.vipNo')}</option>
                    </select>
                </label>
                <label className="flex items-center gap-2">
                    <span className={textMuted}>{t('surveyDetails.filters.businessGroup')}</span>
                    <select
                        value={bgFilter}
                        onChange={(e) => setBgFilter(e.target.value)}
                        className={`px-2 py-1 rounded border text-xs ${inputCls}`}
                    >
                        <option value="all">{t('common.all')}</option>
                        {bgOptions.map((b) => (
                            <option key={b} value={b}>
                                {b}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex items-center gap-2">
                    <span className={textMuted}>{t('surveyDetails.filters.country')}</span>
                    <select
                        value={countryFilter}
                        onChange={(e) => setCountryFilter(e.target.value)}
                        className={`px-2 py-1 rounded border text-xs ${inputCls}`}
                    >
                        <option value="all">{t('common.all')}</option>
                        {countryOptions.map((c) => (
                            <option key={c} value={c}>
                                {c}
                            </option>
                        ))}
                    </select>
                </label>
                <RangeSliderFilter
                    label={t('surveyDetails.filters.surveyRate')}
                    min={1}
                    max={5}
                    value={rateRange}
                    onChange={setRateRange}
                />
                <div className="flex items-center gap-2 ml-auto">
                    <Clock className="w-4 h-4 opacity-70" />
                    <input
                        type="date"
                        value={from ?? ''}
                        onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))}
                        className={`px-2 py-1 rounded border text-xs ${inputCls}`}
                    />
                    <span className={textMuted}>→</span>
                    <input
                        type="date"
                        value={to ?? ''}
                        onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))}
                        className={`px-2 py-1 rounded border text-xs ${inputCls}`}
                    />
                </div>
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

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                    <KpiCard
                        label={t('surveyDetails.kpis.survey')}
                        value={fmtNum(kpis.surveyCount)}
                        valueSize="xl"
                    
                        tooltip={t('surveyDetails.kpis.surveyInfo')}
    />
                    <div className={`rounded-xl border p-4 flex flex-col justify-center ${mutedCardCls}`}>
                        <p className={`text-[10px] uppercase tracking-wide ${textMuted}`}>
                            {t('surveyDetails.kpis.avgRate')}
                        </p>
                        <p
                            className="text-4xl font-bold mt-1"
                            style={{ color: OHLA_PALETTE.avgRateGreen }}
                        >
                            {kpis.avgRate === null ? '—' : kpis.avgRate.toFixed(2)}
                        </p>
                    </div>
                </div>

                <DataTableCard
                    title={t('surveyDetails.charts.details')}
                    rows={detailRows}
                    columns={columns}
                    totalCount={detailRows.length}
                    emptyText={t('common.noData')}
                    csvFilename="ohla_survey_details"
                />
            </div>
        </div>
    )
}
