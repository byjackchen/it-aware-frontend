'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { ServiceNowMonthDetails } from '@/lib/types/survey-analytics';

interface Props {
  batchOid: string;
  months: Array<{ month: string; label: string }>;
}

const PAGE_SIZE = 50;

export function ServiceNowMonthDetails({ batchOid, months }: Props) {
  const t = useTranslations('SurveyAnalytics.serviceQuality');
  const locale = useLocale();
  const [requestedMonth, setRequestedMonth] = useState('2026-07');
  const [loaded, setLoaded] = useState<{ key: string; data: ServiceNowMonthDetails } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);
  const [page, setPage] = useState(1);
  const selectedMonth = months.some((item) => item.month === requestedMonth)
    ? requestedMonth : months.at(-1)?.month;
  const requestKey = `${batchOid}:${selectedMonth}`;
  const details = loaded?.key === requestKey ? loaded.data : null;
  const error = failed?.key === requestKey ? failed.message : null;
  const loading = !!selectedMonth && !details && !error;

  useEffect(() => {
    if (!selectedMonth) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ batch_oid: batchOid, month: selectedMonth });
    fetch(`/api/dashboard/survey-analytics/servicenow-month-details?${params}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(t('detailLoadFailed'));
        return response.json() as Promise<ServiceNowMonthDetails>;
      })
      .then((result) => setLoaded({ key: requestKey, data: result }))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setFailed({ key: requestKey, message: cause instanceof Error ? cause.message : t('detailLoadFailed') });
      });
    return () => controller.abort();
  }, [batchOid, selectedMonth, requestKey, t]);

  const tickets = details?.tickets ?? [];
  const pages = Math.max(1, Math.ceil(tickets.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = tickets.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const dateFormat = new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  });

  return (
    <section className="mt-8 border-t border-[#dbe4f4] pt-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold">{t('detailTitle')}</h3>
          <p className="mt-1 text-sm text-[#60729a]">{t('detailSubtitle')}</p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-semibold text-[#50648f]">
          {t('detailMonth')}
          <select aria-label={t('detailMonth')} value={selectedMonth ?? ''}
            onChange={(event) => { setRequestedMonth(event.target.value); setPage(1); }}
            className="min-w-40 rounded-md border border-[#cad6eb] bg-white px-3 py-2 text-sm text-[#142960]">
            {months.map((item) => <option key={item.month} value={item.month}>{item.label}</option>)}
          </select>
        </label>
      </div>
      {loading && <p className="rounded-lg bg-[#f4f7fd] p-5 text-sm">{t('detailLoading')}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {!loading && !error && details && (
        <>
          <p className="mb-3 text-sm text-[#445986]">
            {t('detailCounts', { tickets: details.ticket_count, assessments: details.assessment_count })}
          </p>
          <div className="overflow-x-auto rounded-xl border border-[#dbe4f4]">
            <table className="min-w-[1050px] w-full border-collapse text-left text-sm">
              <thead className="bg-[#142f82] text-white"><tr>
                <th className="px-3 py-3">{t('detailTicket')}</th>
                <th className="px-3 py-3">{t('detailClosedAt')}</th>
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
            <span>{t('detailPage', { page: currentPage, pages })}</span>
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}
              className="rounded border border-[#cad6eb] px-3 py-1.5 disabled:opacity-40">{t('detailPrevious')}</button>
            <button type="button" disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}
              className="rounded border border-[#cad6eb] px-3 py-1.5 disabled:opacity-40">{t('detailNext')}</button>
          </div>
        </>
      )}
    </section>
  );
}
