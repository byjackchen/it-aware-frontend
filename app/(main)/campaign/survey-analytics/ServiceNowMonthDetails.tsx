'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { ServiceNowMonthDetails, ServiceNowTicketDetail } from '@/lib/types/survey-analytics';
import { downloadXlsx } from '@/lib/utils/export-xlsx';

type DetailScope = 'all' | 'csat' | 'poor' | 'feedback';
type DateBasis = 'opened' | 'closed' | 'taken_on';
type DetailPart = 'denominator' | 'numerator';
type DetailFilters = { ratedOnly: boolean; ratings: number[] };

interface Props {
  batchOid: string;
  months: Array<{ month: string; label: string }>;
  timezone: string;
  csatNumeratorDate: DateBasis;
  csatDenominatorDate: DateBasis;
  poorNumeratorDate: DateBasis;
  feedbackNumeratorDate: DateBasis;
}

const PAGE_SIZE = 50;

function detailSearchParams(batchOid: string, month: string, timezone: string, scope: DetailScope, part: DetailPart, denominatorDate: DateBasis, numeratorDate: DateBasis, page: number, filters: DetailFilters | null) {
  const params = new URLSearchParams({
    batch_oid: batchOid, month, timezone, scope, part, denominator_date: denominatorDate,
    numerator_date: numeratorDate, page: String(page),
  });
  if (filters) {
    params.set('rated_only', String(filters.ratedOnly));
    for (const rating of filters.ratings) params.append('ratings', String(rating));
  }
  return params;
}

export function ServiceNowMonthDetails({ batchOid, months, timezone, csatNumeratorDate, csatDenominatorDate, poorNumeratorDate, feedbackNumeratorDate }: Props) {
  const t = useTranslations('SurveyAnalytics.serviceQuality');
  const locale = useLocale();
  // Empty until the user picks one: the latest month in the range is shown.
  const [requestedMonth, setRequestedMonth] = useState('');
  const [detailScope, setDetailScope] = useState<DetailScope>('all');
  const [detailPart, setDetailPart] = useState<DetailPart>('denominator');
  const denominatorDate: DateBasis = detailScope === 'csat' ? csatDenominatorDate
    : detailScope === 'poor' || detailScope === 'feedback' ? 'opened' : 'closed';
  const numeratorDate: DateBasis = detailScope === 'poor' ? poorNumeratorDate
    : detailScope === 'feedback' ? feedbackNumeratorDate : csatNumeratorDate;
  const activePart: DetailPart = detailScope === 'poor' || detailScope === 'feedback' ? detailPart : 'denominator';
  const activeDate: DateBasis = activePart === 'numerator' ? numeratorDate : denominatorDate;
  const [loaded, setLoaded] = useState<{ key: string; data: ServiceNowMonthDetails } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const [paging, setPaging] = useState({ key: '', page: 1 });
  const [ratedOnly, setRatedOnly] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number[]>([]);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<DetailFilters>({ ratedOnly: false, ratings: [] });
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const selectedMonth = months.some((item) => item.month === requestedMonth)
    ? requestedMonth : months.at(-1)?.month;
  const activeFilters = detailScope === 'all' ? appliedFilters : null;
  const selectionKey = JSON.stringify([batchOid, selectedMonth, timezone, detailScope, activePart, activeDate, activeFilters]);
  const page = paging.key === selectionKey ? paging.page : 1;
  const requestKey = JSON.stringify([selectionKey, page]);
  const details = loaded?.key === requestKey ? loaded.data : null;
  const error = failed?.key === requestKey ? failed.message : null;
  const loading = !!selectedMonth && !details && !error;

  useEffect(() => {
    if (!selectedMonth) return;
    const controller = new AbortController();
    const params = detailSearchParams(batchOid, selectedMonth, timezone, detailScope, activePart, denominatorDate, numeratorDate, page, activeFilters);
    fetch(`/api/dashboard/survey-analytics/servicenow-month-details?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(t('detailLoadFailed'));
        return response.json() as Promise<ServiceNowMonthDetails>;
      })
      .then((result) => {
        const lastPage = Math.max(1, Math.ceil(result.filtered_ticket_count / PAGE_SIZE));
        if (page > lastPage) {
          setPaging({ key: selectionKey, page: lastPage });
          return;
        }
        // A refetch of a key that failed before (month switched back, Apply
        // pressed again) is a retry: its outcome replaces the earlier one.
        setLoaded({ key: requestKey, data: result });
        setFailed((current) => (current?.key === requestKey ? null : current));
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setFailed({ key: requestKey, message: cause instanceof Error ? cause.message : t('detailLoadFailed') });
        setLoaded((current) => (current?.key === requestKey ? null : current));
      });
    return () => controller.abort();
  }, [batchOid, selectedMonth, timezone, detailScope, activePart, denominatorDate, numeratorDate, page, activeFilters, requestKey, selectionKey, t]);

  const pages = Math.max(1, Math.ceil((details?.filtered_ticket_count ?? 0) / PAGE_SIZE));
  const visible = details?.tickets ?? [];
  const dateFormat = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: timezone,
  });
  const ticketDate = (ticket: ServiceNowTicketDetail) => {
    if (activeDate === 'opened') return ticket.source_opened_at;
    if (activeDate === 'closed') return ticket.source_closed_at;
    return ticket.assessments.map((assessment) => assessment.source_taken_on)
      .filter((value): value is string => !!value).sort().at(-1) ?? null;
  };
  const formattedDate = (value: string | null) => value ? dateFormat.format(new Date(value)) : '—';
  const dateHeader = t(activeDate === 'opened' ? 'detailOpenedAt'
    : activeDate === 'closed' ? 'detailClosedAt' : 'detailTakenOnAt', { timezone });
  const scopeLabel = t(detailScope === 'all' ? 'detailScopeAll'
    : detailScope === 'csat' ? 'detailScopeCsat'
      : detailScope === 'poor' ? 'detailScopePoor' : 'detailScopeFeedback');
  const partLabel = t(activePart === 'numerator' ? 'detailNumerator' : 'detailDenominator');
  const exportScopeLabel = detailScope === 'poor' || detailScope === 'feedback'
    ? `${scopeLabel} · ${partLabel}` : scopeLabel;

  const downloadDetails = async () => {
    if (!details || !selectedMonth || exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const totalPages = Math.ceil(details.filtered_ticket_count / PAGE_SIZE);
      const allTickets: ServiceNowTicketDetail[] = [];
      for (let nextPage = 1; nextPage <= totalPages; nextPage++) {
        if (nextPage === page) {
          allTickets.push(...details.tickets);
          continue;
        }
        const params = detailSearchParams(batchOid, selectedMonth, timezone, detailScope, activePart, denominatorDate, numeratorDate, nextPage, activeFilters);
        const response = await fetch(`/api/dashboard/survey-analytics/servicenow-month-details?${params}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(t('detailExportFailed'));
        const result = await response.json() as ServiceNowMonthDetails;
        if (result.filtered_ticket_count !== details.filtered_ticket_count) throw new Error(t('detailExportFailed'));
        allTickets.push(...result.tickets);
      }
      if (allTickets.length !== details.filtered_ticket_count) throw new Error(t('detailExportFailed'));
      const headers = [t('detailMonth'), t('detailMetric'), t('detailTicket'), dateHeader,
        t('detailSummary'), t('detailCaller'), t('detailGroup'), t('detailAssessmentCount'),
        t('detailAssessmentIds'), t('detailScores'), t('detailSubmittedAt'), t('detailTakenOn'),
        t('detailRawQuestions'), t('detailRawAnswers')];
      const rows = allTickets.map((ticket) => [
        selectedMonth, exportScopeLabel, ticket.stable_id, formattedDate(ticketDate(ticket)),
        ticket.title, ticket.caller_name ?? '', ticket.assigned_group ?? '', ticket.assessments.length,
        ticket.assessments.map((assessment) => assessment.external_id ?? assessment.oid).join('\n'),
        ticket.assessments.map((assessment) => assessment.rating ?? '').join('\n'),
        ticket.assessments.map((assessment) => formattedDate(assessment.submitted_at)).join('\n'),
        ticket.assessments.map((assessment) => formattedDate(assessment.source_taken_on)).join('\n'),
        ticket.assessments.map((assessment) => JSON.stringify(assessment.survey_questions)).join('\n---\n'),
        ticket.assessments.map((assessment) => JSON.stringify(assessment.survey_answer)).join('\n---\n'),
      ]);
      const partSuffix = detailScope === 'poor' || detailScope === 'feedback' ? `_${activePart}` : '';
      downloadXlsx('ServiceNow tickets', headers, rows, `servicenow_tickets_${selectedMonth}_${detailScope}${partSuffix}.xlsx`);
    } catch {
      setExportError(t('detailExportFailed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="mt-8 border-t border-[#dbe4f4] pt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">{t('detailTitle')}</h3>
          <p className="mt-1 text-sm text-[#60729a]">{t('detailSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#50648f]">
            {t('detailMetric')}
            <select value={detailScope} onChange={(event) => { setDetailScope(event.target.value as DetailScope); setDetailPart('denominator'); }}
              className="min-w-32 rounded-md border border-[#cad6eb] bg-white px-3 py-2 text-sm text-[#142960]">
              <option value="all">{t('detailScopeAll')}</option>
              <option value="csat">{t('detailScopeCsat')}</option>
              <option value="poor">{t('detailScopePoor')}</option>
              <option value="feedback">{t('detailScopeFeedback')}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#50648f]">
            {t('detailMonth')}
            <select aria-label={t('detailMonth')} value={selectedMonth ?? ''}
              onChange={(event) => setRequestedMonth(event.target.value)}
              className="min-w-40 rounded-md border border-[#cad6eb] bg-white px-3 py-2 text-sm text-[#142960]">
              {months.map((item) => <option key={item.month} value={item.month}>{item.label}</option>)}
            </select>
          </label>
          {detailScope === 'all' && <>
            <label className="flex items-center gap-2 rounded-md border border-[#cad6eb] bg-white px-3 py-2 text-sm font-medium text-[#142960]">
              <input type="checkbox" checked={ratedOnly} onChange={(event) => setRatedOnly(event.target.checked)} />
              {t('detailRatedOnly')}
            </label>
            <div className="relative flex flex-col gap-1 text-xs font-semibold text-[#50648f]">
              <span>{t('detailRating')}</span>
              <button type="button" aria-label={t('detailRating')} aria-expanded={ratingOpen} aria-controls="service-now-rating-options"
                onClick={() => setRatingOpen((open) => !open)}
                className="flex min-w-36 items-center justify-between gap-3 rounded-md border border-[#cad6eb] bg-white px-3 py-2 text-left text-sm text-[#142960]">
                <span>{ratingFilter.length === 0 ? t('detailAllRatings') : ratingFilter.join(', ')}</span>
                <span aria-hidden="true" className="text-[#60729a]">▾</span>
              </button>
              {ratingOpen && (
                <div id="service-now-rating-options" role="group" aria-label={t('detailRating')}
                  className="absolute right-0 top-full z-30 mt-1 w-full rounded-md border border-[#cad6eb] bg-white p-1 shadow-lg">
                  <button type="button" onClick={() => setRatingFilter([])}
                    className="w-full rounded px-2 py-1.5 text-left text-sm text-[#142960] hover:bg-[#eaf0ff]">
                    {t('detailAllRatings')}
                  </button>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <label key={rating} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-[#142960] hover:bg-[#eaf0ff]">
                      <input type="checkbox" checked={ratingFilter.includes(rating)}
                        onChange={(event) => setRatingFilter((current) => event.target.checked
                          ? [...current, rating].sort((a, b) => a - b)
                          : current.filter((value) => value !== rating))} />
                      {rating}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={() => { setAppliedFilters({ ratedOnly, ratings: ratingFilter }); setRatingOpen(false); }}
              className="rounded-md bg-[#2455d4] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b42ad]">
              {t('detailApply')}
            </button>
          </>}
          {(detailScope === 'poor' || detailScope === 'feedback') && (
            <div role="group" aria-label={t('detailPart')} className="inline-flex rounded-md border border-[#cad6eb] bg-white p-1 text-sm font-semibold">
              {(['denominator', 'numerator'] as const).map((part) => (
                <button key={part} type="button" aria-pressed={activePart === part}
                  onClick={() => setDetailPart(part)}
                  className={`rounded px-3 py-1.5 ${activePart === part ? 'bg-[#2455d4] text-white' : 'text-[#142960] hover:bg-[#eaf0ff]'}`}>
                  {t(part === 'denominator' ? 'detailDenominator' : 'detailNumerator')}
                </button>
              ))}
            </div>
          )}
          <button type="button" onClick={downloadDetails} disabled={!details || exporting}
            className="inline-flex items-center gap-2 rounded-md bg-[#2455d4] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            <Download className="h-4 w-4" />{exporting ? t('detailExporting') : t('downloadExcel')}
          </button>
        </div>
      </div>
      {exportError && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{exportError}</p>}
      {loading && <p className="rounded-lg bg-[#f4f7fd] p-5 text-sm">{t('detailLoading')}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!loading && !error && details && (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[#445986]">
            <span>{t(detailScope === 'csat' ? 'detailCsatCounts'
              : activePart === 'numerator' ? 'detailNumeratorCounts' : 'detailCounts',
            { tickets: details.ticket_count, assessments: details.assessment_count })}</span>
            <span role="status" aria-live="polite" className="rounded-full bg-[#eaf0ff] px-3 py-1 font-semibold text-[#2455d4]">
              {t('detailFilteredCount', { shown: details.filtered_ticket_count })}
            </span>
          </p>
          <div className="overflow-x-auto rounded-xl border border-[#dbe4f4]">
            <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
              <thead className="bg-[#142f82] text-white"><tr>
                <th className="px-3 py-3">{t('detailTicket')}</th>
                <th className="px-3 py-3">{dateHeader}</th>
                <th className="px-3 py-3">{t('detailSummary')}</th>
                <th className="px-3 py-3">{t('detailCaller')}</th>
                <th className="px-3 py-3">{t('detailGroup')}</th>
                <th className="px-3 py-3">{t('detailAssessments')}</th>
              </tr></thead>
              <tbody>
                {visible.map((ticket) => <tr key={ticket.oid} className="border-t border-[#dce5f2] align-top">
                  <td className="px-3 py-3 font-semibold">{ticket.stable_id}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formattedDate(ticketDate(ticket))}</td>
                  <td className="max-w-80 px-3 py-3">{ticket.title}</td>
                  <td className="px-3 py-3">{ticket.caller_name || '—'}</td>
                  <td className="px-3 py-3">{ticket.assigned_group || '—'}</td>
                  <td className="px-3 py-3">
                    {ticket.assessments.length === 0 ? t('detailNoAssessment') : ticket.assessments.map((assessment) => (
                      <details key={assessment.oid} className="mb-2 rounded-md border border-[#dbe4f4] bg-[#f8faff] p-2 last:mb-0">
                        <summary className="cursor-pointer font-semibold text-[#2455d4]">{t('detailViewRaw')} · {assessment.rating ?? '—'} / 5</summary>
                        <div className="mt-2 text-xs text-[#50648f]">
                          <p>{assessment.external_id || assessment.oid} · {assessment.source_taken_on ? `${t('dateTakenOn')}: ${dateFormat.format(new Date(assessment.source_taken_on))}` : '—'}</p>
                          <p className="mt-2 font-semibold">{t('detailRawQuestions')}</p>
                          <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded bg-white p-2 text-[#263b68]">{JSON.stringify(assessment.survey_questions, null, 2)}</pre>
                          <p className="mt-2 font-semibold">{t('detailRawAnswers')}</p>
                          <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded bg-white p-2 text-[#263b68]">{JSON.stringify(assessment.survey_answer, null, 2)}</pre>
                        </div>
                      </details>
                    ))}
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-end gap-3 text-sm">
            <span>{t('detailPage', { page, pages })}</span>
            <button type="button" disabled={page <= 1} onClick={() => setPaging({ key: selectionKey, page: page - 1 })}
              className="rounded border border-[#cad6eb] px-3 py-1.5 disabled:opacity-40">{t('detailPrevious')}</button>
            <button type="button" disabled={page >= pages} onClick={() => setPaging({ key: selectionKey, page: page + 1 })}
              className="rounded border border-[#cad6eb] px-3 py-1.5 disabled:opacity-40">{t('detailNext')}</button>
          </div>
        </>
      )}
    </section>
  );
}
