'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ACTIONS_PAGE_SIZE, jobsHref } from '@/lib/jobs/paths';
import type { ActionOutcome, ActionsResponse } from '@/lib/types/jobs';
import { Pager, tdClass, thClass, When } from './parts';

const OUTCOME_CLASS: Record<ActionOutcome, string> = {
  pending: 'bg-amber-500/15 text-warn',
  succeeded: 'bg-green-500/15 text-good',
  failed: 'bg-red-500/15 text-bad',
  refused: 'bg-gray-500/15 text-ink-2',
};

/** The record of control and recovery actions: who, what, which job and run, when, and how it ended. */
export function ActionRecord({ data, job, page }: { data: ActionsResponse; job: string | null; page: number }) {
  const t = useTranslations('Jobs.record');
  return (
    <>
      {job && (
        <div className="mb-3 flex items-center gap-3 text-sm">
          <span className="theme-text-primary">{t('forJob', { job })}</span>
          <Link href={jobsHref({ tab: 'actions' })} className="text-accent hover:underline">{t('showAll')}</Link>
        </div>
      )}
      {data.actions.length === 0 ? (
        <p className="py-8 text-center text-muted">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="action-record">
            <thead>
              <tr className="border-b border-line">
                <th className={thClass}>{t('columns.when')}</th>
                <th className={thClass}>{t('columns.who')}</th>
                <th className={thClass}>{t('columns.what')}</th>
                <th className={thClass}>{t('columns.job')}</th>
                <th className={thClass}>{t('columns.run')}</th>
                <th className={thClass}>{t('columns.outcome')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.actions.map((a) => (
                <tr key={a.id} className="hover:bg-hover">
                  <td className={`${tdClass} text-ink-2`}><When iso={a.requested_at} /></td>
                  <td className={`${tdClass} theme-text-primary`}>{a.username}</td>
                  <td className={`${tdClass} theme-text-primary`}>
                    {t(`action.${a.action}`)}
                    {a.parameters && Object.keys(a.parameters).length > 0 && (
                      <div className="font-mono text-xs text-muted">{JSON.stringify(a.parameters)}</div>
                    )}
                  </td>
                  <td className={tdClass}>
                    <Link href={jobsHref({ job: a.job_id })} className="font-mono text-accent hover:underline">{a.job_id}</Link>
                  </td>
                  <td className={tdClass}>
                    {a.run_id ? (
                      <Link href={jobsHref({ job: a.job_id, run: a.run_id })} className="font-mono text-xs text-accent hover:underline">
                        {a.run_id}
                      </Link>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className={tdClass}>
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${OUTCOME_CLASS[a.outcome]}`}
                      title={a.outcome === 'pending' ? t('pendingHelp') : undefined}
                    >
                      {t(`outcome.${a.outcome}`)}
                    </span>
                    {a.error && <div className="mt-1 max-w-sm text-xs text-bad">{a.error}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={data.total} size={ACTIONS_PAGE_SIZE} link={job ? { tab: 'actions', job } : { tab: 'actions' }} />
    </>
  );
}
