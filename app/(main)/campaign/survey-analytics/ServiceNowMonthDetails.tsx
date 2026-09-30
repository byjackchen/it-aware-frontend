'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ServiceNowMonthDetails } from '@/lib/types/survey-analytics';

interface Props {
  batchOid: string;
  months: Array<{ month: string; label: string }>;
  timezone: string;
}

const PAGE_SIZE = 50;

export function ServiceNowMonthDetails({ batchOid, months, timezone }: Props) {
  const t = useTranslations('SurveyAnalytics.serviceQuality');
  const locale = useLocale();
  const [requestedMonth, setRequestedMonth] = useState('2026-07');
  const [loaded, setLoaded] = useState<{ key: string; data: ServiceNowMonthDetails } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const [paging, setPaging] = useState({ key: '', page: 1 });
  const [ratedOnly, setRatedOnly] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number[]>([]);
  const [ratingOpen, setRatingOpen] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({ ratedOnly: false, ratings: [] as number[] });
  const selectedMonth = months.some((item) => item.month === requestedMonth)
    ? requestedMonth : months.at(-1)?.month;
  const selectionKey = JSON.stringify([batchOid, selectedMonth, timezone, appliedFilters]);
  const page = paging.key === selectionKey ? paging.page : 1;
  const requestKey = JSON.stringify([selectionKey, page]);
  const details = loaded?.key === requestKey ? loaded.data : null;
  const error = failed?.key === requestKey ? failed.message : null;
  const loading = !!selectedMonth && !details && !error;

  useEffect(() => {
    if (!selectedMonth) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      batch_oid: batchOid, month: selectedMonth, timezone,
      page: String(page), rated_only: String(appliedFilters.ratedOnly),
    });
    for (const rating of appliedFilters.ratings) params.append('ratings', String(rating));
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
        setLoaded({ key: requestKey, data: result });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setFailed({ key: requestKey, message: cause instanceof Error ? cause.message : t('detailLoadFailed') });
      });
    return () => controller.abort();
  }, [batchOid, selectedMonth, timezone, page, appliedFilters, requestKey, selectionKey, t]);

  const pages = Math.max(1, Math.ceil((details?.filtered_ticket_count ?? 0) / PAGE_SIZE));
  const visible = details?.tickets ?? [];
  const dateFormat = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: timezone,
  });

  return (
    <section className="mt-8 border-t border-[#dbe4f4] pt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">{t('detailTitle')}</h3>
          <p className="mt-1 text-sm text-[#60729a]">{t('detailSubtitle')}</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-semibold text-[#50648f]">
            {t('detailMonth')}
            <select aria-label={t('detailMonth')} value={selectedMonth ?? ''}
              onChange={(event) => setRequestedMonth(event.target.value)}
              className="min-w-40 rounded-md border border-[#cad6eb] bg-white px-3 py-2 text-sm text-[#142960]">
              {months.map((item) => <option key={item.month} value={item.month}>{item.label}</option>)}
            </select>
          </label>
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
        </div>
      </div>
      {loading && <p className="rounded-lg bg-[#f4f7fd] p-5 text-sm">{t('detailLoading')}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!loading && !error && details && (
        <>
          <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-[#445986]">
            <span>{t('detailCounts', { tickets: details.ticket_count, assessments: details.assessment_count })}</span>
            <span role="status" aria-live="polite" className="rounded-full bg-[#eaf0ff] px-3 py-1 font-semibold text-[#2455d4]">
              {t('detailFilteredCount', { shown: details.filtered_ticket_count })}
            </span>
          </p>
          <div className="overflow-x-auto rounded-xl border border-[#dbe4f4]">
            <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
              <thead className="bg-[#142f82] text-white"><tr>
                <th className="px-3 py-3">{t('detailTicket')}</th>
                <th className="px-3 py-3">{t('detailClosedAt', { timezone })}</th>
                <th className="px-3 py-3">{t('detailSummary')}</th>
                <th className="px-3 py-3">{t('detailCaller')}</th>
                <th className="px-3 py-3">{t('detailGroup')}</th>
                <th className="px-3 py-3">{t('detailAssessments')}</th>
              </tr></thead>
              <tbody>
                {visible.map((ticket) => <tr key={ticket.oid} className="border-t border-[#dce5f2] align-top">
                  <td className="px-3 py-3 font-semibold">{ticket.stable_id}</td>
                  <td className="whitespace-nowrap px-3 py-3">{dateFormat.format(new Date(ticket.source_closed_at))}</td>
                  <td className="max-w-80 px-3 py-3">{ticket.title}</td>
                  <td className="px-3 py-3">{ticket.caller_name || '—'}</td>
                  <td className="px-3 py-3">{ticket.assigned_group || '—'}</td>
                  <td className="px-3 py-3">
                    {ticket.assessments.length === 0 ? t('detailNoAssessment') : ticket.assessments.map((assessment) => (
                      <details key={assessment.oid} className="mb-2 rounded-md border border-[#dbe4f4] bg-[#f8faff] p-2 last:mb-0">
                        <summary className="cursor-pointer font-semibold text-[#2455d4]">{t('detailViewRaw')} · {assessment.rating ?? '—'} / 5</summary>
                        <div className="mt-2 text-xs text-[#50648f]">
                          <p>{assessment.external_id || assessment.oid} · {dateFormat.format(new Date(assessment.submitted_at))}</p>
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
