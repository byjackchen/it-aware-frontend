'use client'

/**
 * Ohla Survey Details — Power BI "Survey Details" page port.
 *
 * Performance: KPIs (Survey#, AVG Rate) + dropdown options come from the
 * server-aggregated /report/ohla-chatbot-survey endpoint. The 4 ad-hoc
 * filters (VIP / BG / Country / Rate range) are sent as query params to
 * the same endpoint so the BE recomputes KPIs filtered — same UX as the
 * original FE.
 *
 * The detail table loads small filtered survey rows from
 * /interactions?survey_received=true. The rate-range filter applies to
 * the table client-side; vip/bg/country can't filter the table without
 * worker enrichment of detail rows (separate follow-up — FE workaround
 * is to use the dropdowns to drive the KPI cards while the table shows
 * the unenriched survey rows for the period).
 *
 * PBIX "Survey Received? = Yes" is detected on the BE side via regex on
 * content_text matching `(?:rateticket|ticket_rating)-naive-...-{rate}|...`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, RefreshCw, ClipboardSignature } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useTheme } from '@/lib/contexts/theme-context'
import { useOhlaChatbotReport } from '@/lib/hooks/useOhlaChatbotReport'
import { OHLA_PALETTE } from '@/lib/ohla/colors'
import { KpiCard } from '@/components/ops_dashboard/KpiCard'
import { DataTableCard, type Column } from '@/components/ops_dashboard/DataTableCard'
import { RangeSliderFilter } from '@/components/ohla/RangeSliderFilter'
import { useOhlaDateRange } from '@/lib/hooks/useOhlaDateRange'
import { maskWecomId } from '@/lib/ohla/mask'
import { ExpandableText } from '@/components/ohla/ExpandableText'
import type { Interaction } from '@/lib/types/objects'

function fmtNum(n: number): string {
    return n.toLocaleString()
}

function quarterOf(m: number): string {
    return `Qtr ${Math.floor((m - 1) / 3) + 1}`
}
function monthName(m: number): string {
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]
}

const SURVEY_RE = /(?:rateticket|ticket_rating)-naive-[A-Z0-9]+-([1-5])\|/

function extractSurveyRate(contentText: string | null): number | null {
    if (!contentText) return null
    const m = contentText.match(SURVEY_RE)
    return m ? Number(m[1]) : null
}

interface DetailRow {
    year: number
    quarter: string
    month: string
    day: number
    actorStableId: string
    userContent: string | null
    surveyRate: number | null
    userContent2: string | null
}

function toDetailRow(i: Interaction): DetailRow {
    const d = new Date(i.created_at)
    const m = d.getUTCMonth() + 1
    return {
        year: d.getUTCFullYear(),
        quarter: quarterOf(m),
        month: monthName(m),
        day: d.getUTCDate(),
        actorStableId: i.actor_stable_id,
        userContent: i.content_text ?? null,
        surveyRate: extractSurveyRate(i.content_text ?? null),
        userContent2: i.content_text ?? null,
    }
}

type VipFilter = 'all' | 'vip' | 'non-vip'

const ZERO_KPIS = { survey_count: 0, avg_survey_rate: null as number | null } as const
const ZERO_OPTIONS = { business_groups: [] as string[], countries: [] as string[] }

export function SurveyDetailsDashboard() {
    const t = useTranslations('Ohla')
    const { theme } = useTheme()
    const isLight = theme === 'light'

    const { range: { from, to }, setRange } = useOhlaDateRange()

    const [vipFilter, setVipFilter] = useState<VipFilter>('all')
    const [bgFilter, setBgFilter] = useState<string>('all')
    const [countryFilter, setCountryFilter] = useState<string>('all')
    const [rateRange, setRateRange] = useState<[number, number]>([1, 5])

    // Translate filter UI state into BE query params.
    const reportExtra = useMemo<Record<string, string>>(() => {
        const out: Record<string, string> = {}
        if (vipFilter === 'vip') out.vip = 'true'
        else if (vipFilter === 'non-vip') out.vip = 'false'
        if (bgFilter !== 'all') out.bg = bgFilter
        if (countryFilter !== 'all') out.country = countryFilter
        // Send rate bounds only if user moved them off the defaults.
        if (rateRange[0] !== 1) out.rate_min = String(rateRange[0])
        if (rateRange[1] !== 5) out.rate_max = String(rateRange[1])
        return out
    }, [vipFilter, bgFilter, countryFilter, rateRange])

    const {
        data: report,
        loading: reportLoading,
        error: reportError,
        refetch: refetchReport,
    } = useOhlaChatbotReport('survey', { from, to, extraParams: reportExtra })

    const block = report?.current
    const kpis = block?.kpis ?? ZERO_KPIS
    const options = block?.filter_options ?? ZERO_OPTIONS

    // Detail rows — small filtered list of survey-received interactions.
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
            params.set('survey_received', 'true')
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

    // Apply rate-range to the table (the only filter we can apply without
    // worker-context enrichment of detail rows).
    const detailRowsMapped = useMemo(() => {
        return detailRows.map(toDetailRow).filter((r) => {
            if (typeof r.surveyRate === 'number') {
                if (r.surveyRate < rateRange[0] || r.surveyRate > rateRange[1]) return false
            }
            return true
        })
    }, [detailRows, rateRange])

    const loading = reportLoading || detailLoading
    const error = reportError ?? detailError

    const columns: Column<DetailRow>[] = [
        { key: 'year', label: t('surveyDetails.columns.year') },
        { key: 'quarter', label: t('surveyDetails.columns.quarter') },
        { key: 'month', label: t('surveyDetails.columns.month') },
        { key: 'day', label: t('surveyDetails.columns.day'), alignRight: true },
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
                        {options.business_groups.map((b) => (
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
                        {options.countries.map((c) => (
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
                        value={fmtNum(kpis.survey_count)}
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
                            {kpis.avg_survey_rate === null ? '—' : kpis.avg_survey_rate.toFixed(2)}
                        </p>
                    </div>
                </div>

                <DataTableCard
                    title={t('surveyDetails.charts.details')}
                    rows={detailRowsMapped}
                    columns={columns}
                    totalCount={detailRowsMapped.length}
                    emptyText={t('common.noData')}
                    csvFilename="ohla_survey_details"
                />
            </div>
        </div>
    )
}
