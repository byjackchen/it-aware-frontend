'use client';

import { useTranslations } from 'next-intl';
import { Notice, Pager, tdClass, thClass, When } from '@/app/(main)/tasks/jobs/parts';
import { CSAT_PAGE_SIZE, cell, withQuery } from '@/lib/data-tasks/view';
import type { CsatResponses } from '@/lib/types/data-tasks';

interface CsatResponsesViewProps {
  read: { ok: true; data: CsatResponses } | { ok: false; message: string };
  page: number;
  incident: string | null;
}

/** The rows of csat.responses the person may see, a page at a time, with a search by incident. */
export function CsatResponsesView({ read, page, incident }: CsatResponsesViewProps) {
  const t = useTranslations('DataTasks.csat');
  return (
    <div className="p-4">
      <div className="glass-card space-y-3 rounded-xl p-4">
        <p className="text-sm text-ink-2">{t('intro')}</p>
        <form method="get" action="/tasks/it-csat" className="flex gap-2">
          <input
            name="incident"
            defaultValue={incident ?? ''}
            placeholder={t('incidentPlaceholder')}
            aria-label={t('incident')}
            className="w-64 rounded-lg border border-line bg-field px-3 py-1.5 text-sm text-ink"
          />
          <button type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-sm text-page">
            {t('search')}
          </button>
        </form>
        {!read.ok ? (
          <Notice tone="error">{t('loadFailed', { message: read.message })}</Notice>
        ) : (
          <>
            <p className="text-sm text-ink" data-testid="csat-total">
              {t('total', { total: read.data.total })}
            </p>
            {read.data.items.length === 0 ? (
              <p className="py-8 text-center text-muted">{t('empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full" data-testid="csat-table">
                  <thead>
                    <tr className="border-b border-line">
                      <th className={thClass}>{t('columns.survey')}</th>
                      <th className={thClass}>{t('columns.incident')}</th>
                      <th className={thClass}>{t('columns.status')}</th>
                      <th className={thClass}>{t('columns.submitted')}</th>
                      <th className={thClass}>{t('columns.takenOn')}</th>
                      <th className={thClass}>{t('columns.answer')}</th>
                      <th className={thClass}>{t('columns.rawSource')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {read.data.items.map((row) => (
                      <tr key={row.oid} className="hover:bg-hover" data-testid="csat-row">
                        <td className={`${tdClass} font-mono text-xs`}>{row.external_id}</td>
                        <td className={tdClass}>{row.incident_number ?? '—'}</td>
                        <td className={tdClass}>{row.status}</td>
                        <td className={`${tdClass} text-ink-2`}><When iso={row.submitted_at} /></td>
                        <td className={`${tdClass} text-ink-2`}><When iso={row.source_taken_on} /></td>
                        <td className={`${tdClass} max-w-md truncate font-mono text-xs`} title={cell(row.survey_answer)}>
                          {cell(row.survey_answer)}
                        </td>
                        <td className={`${tdClass} font-mono text-xs text-ink-2`}>{row.raw_source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager
              page={page}
              total={read.data.total}
              size={CSAT_PAGE_SIZE}
              href={(to) => withQuery('/tasks/it-csat', { incident, page: to })}
            />
          </>
        )}
      </div>
    </div>
  );
}
