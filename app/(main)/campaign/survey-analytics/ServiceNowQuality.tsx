'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, MessageCircle, Star, ThumbsDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import type { TooltipContentProps } from 'recharts';
import { useSurveyAnalytics } from '@/lib/hooks/useSurveyAnalytics';
import { formatMonthLabel, isValidMonthSelection } from '@/lib/survey-quality';
import type { ServiceNowQualityMonth, ServiceNowQualityReport } from '@/lib/types/survey-analytics';
import { ServiceNowMonthDetails } from './ServiceNowMonthDetails';

interface Props {
  batchOid: string;
}

const COLORS = { csat: '#4f7fe9', poor: '#9da0a7', feedback: '#ea792b' };

type QualityMetric = 'csat' | 'poorRate' | 'feedbackRate';

const HELP_KEYS = {
  csat: { definition: 'csatDefinition', formula: 'csatFormula' },
  poorRate: { definition: 'poorRateDefinition', formula: 'poorRateFormula' },
  feedbackRate: { definition: 'feedbackRateDefinition', formula: 'feedbackRateFormula' },
} as const;

function QualityBarTooltip({ active, payload }: TooltipContentProps) {
  const t = useTranslations('SurveyAnalytics.serviceQuality');
  if (!active || !payload?.length) return null;

  const point = payload[0];
  const row = point.payload as ServiceNowQualityMonth & { label: string };
  const metric = point.dataKey;
  let label: string;
  let numerator: number;
  let denominator: number;
  let numeratorLabel: string;
  let denominatorLabel: string;
  let formula: string;

  if (metric === 'csat') {
    label = t('csat');
    numerator = row.rating_sum;
    denominator = row.rating_count;
    numeratorLabel = t('ratingPoints');
    denominatorLabel = t('validRatings');
    formula = `${numerator} ÷ ${denominator} = ${row.csat?.toFixed(2) ?? '—'} / 5`;
  } else if (metric === 'poor_rate') {
    label = t('poorRate');
    numerator = row.poor_count;
    denominator = row.ticket_count;
    numeratorLabel = t('poorTickets');
    denominatorLabel = t('closedTickets');
    formula = `${numerator} ÷ ${denominator} × 100% = ${row.poor_rate?.toFixed(2) ?? '—'}%`;
  } else if (metric === 'feedback_rate') {
    label = t('feedbackRate');
    numerator = row.feedback_count;
    denominator = row.ticket_count;
    numeratorLabel = t('feedbackTickets');
    denominatorLabel = t('closedTickets');
    formula = `${numerator} ÷ ${denominator} × 100% = ${row.feedback_rate?.toFixed(2) ?? '—'}%`;
  } else {
    return null;
  }

  return (
    <div role="tooltip" className="min-w-56 rounded-lg border border-[#dbe4f4] bg-white p-3 text-xs text-[#263b68] shadow-lg">
      <p className="font-bold text-[#132968]">{row.label} · {label}</p>
      <p className="mt-2">{numeratorLabel}: <strong>{numerator}</strong></p>
      <p>{denominatorLabel}: <strong>{denominator}</strong></p>
      <p className="mt-2 border-t border-[#e7ebf3] pt-2 font-bold">{formula}</p>
    </div>
  );
}

function MetricHelp({ metric, label }: { metric: QualityMetric; label: string }) {
  const t = useTranslations('SurveyAnalytics.serviceQuality');
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const keys = HELP_KEYS[metric];
  const show = (element: HTMLButtonElement) => setAnchor(element.getBoundingClientRect());
  const above = anchor ? anchor.bottom > window.innerHeight - 145 : false;

  return (
    <>
      <button
        type="button"
        aria-label={t('aboutMetric', { metric: label })}
        onMouseEnter={(event) => show(event.currentTarget)}
        onMouseLeave={() => setAnchor(null)}
        onFocus={(event) => show(event.currentTarget)}
        onBlur={() => setAnchor(null)}
        className="ml-1 inline-flex h-4 w-4 align-middle items-center justify-center rounded-full border border-[#9aabc9] bg-white text-[10px] font-bold leading-none text-[#506696] hover:border-[#4268bb] hover:text-[#2455d4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2455d4]"
      >
        ?
      </button>
      {anchor && createPortal(
        <div
          role="tooltip"
          className="pointer-events-none fixed z-[100] w-72 rounded-lg border border-[#cdd9ee] bg-white p-3 text-left text-xs font-normal leading-relaxed text-[#263b68] shadow-xl"
          style={{
            left: Math.max(152, Math.min(anchor.left + anchor.width / 2, window.innerWidth - 152)),
            top: above ? anchor.top - 8 : anchor.bottom + 8,
            transform: above ? 'translate(-50%, -100%)' : 'translateX(-50%)',
          }}
        >
          <p className="font-bold text-[#132968]">{t('definition')}</p>
          <p>{t(keys.definition)}</p>
          <p className="mt-2 font-bold text-[#132968]">{t('metricFormula')}</p>
          <p>{t(keys.formula)}</p>
          <p className="mt-2 text-[#60729a]">{t('averageFormula')}</p>
        </div>,
        document.body,
      )}
    </>
  );
}

export function ServiceNowQuality({ batchOid }: Props) {
  const t = useTranslations('SurveyAnalytics.serviceQuality');
  const locale = useLocale();
  const [startMonth, setStartMonth] = useState('2026-01');
  const [endMonth, setEndMonth] = useState('2026-07');
  const validRange = isValidMonthSelection(startMonth, endMonth);
  const params = new URLSearchParams({ batch_oid: batchOid, start_month: startMonth, end_month: endMonth });
  const { data, isLoading, error } = useSurveyAnalytics<ServiceNowQualityReport>(
    validRange ? `/api/dashboard/survey-analytics/servicenow-quality?${params}` : null,
  );

  const monthRows = data?.months.map((row) => ({ ...row, label: formatMonthLabel(row.month, locale) })) ?? [];
  const average = data?.averages;
  const scoreText = (value: number | null | undefined) => value == null ? '—' : value.toFixed(2);
  const percentText = (value: number | null | undefined) => value == null ? '—' : `${value.toFixed(2)}%`;

  return (
    <section className="rounded-2xl border border-[#dbe4f4] bg-white p-4 text-[#132968] shadow-sm md:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
            {t('title', { start: formatMonthLabel(startMonth, locale), end: formatMonthLabel(endMonth, locale) })}
          </h2>
          <p className="mt-2 text-sm font-medium text-[#445986]">{t('formula')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[#dce5f5] bg-[#f7f9fe] p-3">
          <CalendarDays className="mb-2 h-5 w-5 text-[#5274be]" />
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#50648f]">
            {t('startMonth')}
            <input aria-label={t('startMonth')} type="month" value={startMonth}
              onChange={(event) => setStartMonth(event.target.value)}
              className="rounded-md border border-[#cad6eb] bg-white px-2 py-1.5 text-sm text-[#142960]" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#50648f]">
            {t('endMonth')}
            <input aria-label={t('endMonth')} type="month" value={endMonth}
              onChange={(event) => setEndMonth(event.target.value)}
              className="rounded-md border border-[#cad6eb] bg-white px-2 py-1.5 text-sm text-[#142960]" />
          </label>
        </div>
      </div>

      {!validRange && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{t('invalidRange')}</p>}
      {validRange && isLoading && <p className="rounded-lg bg-[#f4f7fd] p-8 text-center text-sm">{t('loading')}</p>}
      {validRange && error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {validRange && !isLoading && !error && data && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="flex items-center gap-4 rounded-xl border border-[#d9e3fb] bg-[#fbfcff] p-5 shadow-[0_1px_5px_rgba(40,82,160,0.06)]">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5789f0] to-[#123dc7] text-white"><Star className="h-9 w-9 fill-current" /></span>
              <div><p className="font-semibold">{t('csat')}<MetricHelp metric="csat" label={t('csat')} /></p><p className="text-3xl font-bold text-[#2455d4]">{scoreText(average?.csat)} / 5</p><p className="text-sm text-[#60729a]">{t('monthlyAverage')}</p></div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[#f4dfd2] bg-[#fffdfb] p-5 shadow-[0_1px_5px_rgba(180,80,30,0.05)]">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f89443] to-[#d74719] text-white"><ThumbsDown className="h-8 w-8 fill-current" /></span>
              <div><p className="font-semibold">{t('poorRate')}<MetricHelp metric="poorRate" label={t('poorRate')} /></p><p className="text-3xl font-bold text-[#df6228]">{percentText(average?.poor_rate)}</p><p className="text-sm text-[#60729a]">{t('monthlyAverage')}</p></div>
            </div>
            <div className="flex items-center gap-4 rounded-xl border border-[#d7e9e1] bg-[#fbfefd] p-5 shadow-[0_1px_5px_rgba(40,130,80,0.05)]">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#68b783] to-[#278452] text-white"><MessageCircle className="h-8 w-8 fill-current" /></span>
              <div><p className="font-semibold">{t('feedbackRate')}<MetricHelp metric="feedbackRate" label={t('feedbackRate')} /></p><p className="text-3xl font-bold text-[#339261]">{percentText(average?.feedback_rate)}</p><p className="text-sm text-[#60729a]">{t('monthlyAverage')}</p></div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-between gap-2 text-sm font-bold">
            <span className="text-[#2d5bd6]">{t('scoreAxis')}</span>
            <div className="flex flex-wrap items-center gap-5 text-[#172d68]">
              <span><i className="mr-2 inline-block h-3 w-3 bg-[#9da0a7]" />{t('poorRate')}</span>
              <span><i className="mr-2 inline-block h-3 w-3 bg-[#4f7fe9]" />{t('csat')}</span>
              <span><i className="mr-2 inline-block h-3 w-3 bg-[#ea792b]" />{t('feedbackRate')}</span>
            </div>
            <span className="text-[#e97527]">{t('percentAxis')}</span>
          </div>

          <div className="mt-3 h-[340px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthRows} margin={{ top: 30, right: 8, bottom: 5, left: -18 }} barGap={4}>
                <CartesianGrid stroke="#e7ebf3" strokeDasharray="4 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#1c326b', fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: '#cbd3e2' }} tickLine={false} />
                <YAxis yAxisId="score" domain={[0, 5]} ticks={[0, 1, 2, 3, 4, 5]} tick={{ fill: '#2456d5', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="percent" orientation="right" domain={[0, 50]} ticks={[0, 10, 20, 30, 40, 50]} tickFormatter={(value: number) => `${value}%`} tick={{ fill: '#e97527', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip shared={false} content={(props) => <QualityBarTooltip {...props} />} />
                <Bar yAxisId="percent" name={t('poorRate')} dataKey="poor_rate" fill={COLORS.poor} maxBarSize={28} minPointSize={3}>
                  <LabelList dataKey="poor_rate" position="top" formatter={(value: unknown) => typeof value === 'number' ? `${value.toFixed(2)}%` : ''} style={{ fill: '#1e3065', fontSize: 11, fontWeight: 700 }} />
                </Bar>
                <Bar yAxisId="score" name={t('csat')} dataKey="csat" fill={COLORS.csat} maxBarSize={36}>
                  <LabelList dataKey="csat" position="top" formatter={(value: unknown) => typeof value === 'number' ? value.toFixed(2) : ''} style={{ fill: '#1e3065', fontSize: 11, fontWeight: 700 }} />
                </Bar>
                <Bar yAxisId="percent" name={t('feedbackRate')} dataKey="feedback_rate" fill={COLORS.feedback} maxBarSize={36}>
                  <LabelList dataKey="feedback_rate" position="top" formatter={(value: unknown) => typeof value === 'number' ? `${value.toFixed(2)}%` : ''} style={{ fill: '#1e3065', fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-[#dbe4f4]">
            <table className="min-w-[760px] w-full border-collapse text-center text-sm">
              <thead className="bg-[#142f82] text-white"><tr>
                <th className="min-w-48 border-r border-white/30 px-3 py-3">{t('metric')}</th>
                {monthRows.map((row) => <th key={row.month} className="min-w-24 border-r border-white/30 px-2 py-3">{row.label}</th>)}
                <th className="min-w-32 px-3 py-3">{t('monthlyAverage')}</th>
              </tr></thead>
              <tbody>
                {([
                  { key: 'csat', helpKey: 'csat', label: t('csat'), color: COLORS.csat, format: scoreText },
                  { key: 'poor_rate', helpKey: 'poorRate', label: t('poorRate'), color: COLORS.poor, format: percentText },
                  { key: 'feedback_rate', helpKey: 'feedbackRate', label: t('feedbackRate'), color: COLORS.feedback, format: percentText },
                ] as const).map((metric) => (
                  <tr key={metric.key} className="border-t border-[#dce5f2]">
                    <th className="border-r border-[#dce5f2] bg-[#fbfcff] px-4 py-3 text-left font-semibold">
                      <i className="mr-3 inline-block h-3 w-3" style={{ backgroundColor: metric.color }} />{metric.label}<MetricHelp metric={metric.helpKey} label={metric.label} />
                    </th>
                    {monthRows.map((row) => <td key={row.month} className="border-r border-[#dce5f2] px-2 py-3 font-semibold">{metric.format(row[metric.key])}</td>)}
                    <td className="px-3 py-3 font-bold" style={{ color: metric.color }}>{metric.format(average?.[metric.key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-right text-xs text-[#60729a]">{t('sourceNote')}</p>
          <ServiceNowMonthDetails batchOid={batchOid} months={monthRows.map(({ month, label }) => ({ month, label }))} />
        </>
      )}
    </section>
  );
}
