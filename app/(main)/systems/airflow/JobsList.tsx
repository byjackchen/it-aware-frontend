'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Pause, Search, Workflow } from 'lucide-react';
import { jobsHref } from '@/lib/jobs/paths';
import { filterJobs, JOB_FILTERS, type JobFilter } from '@/lib/jobs/view';
import type { JobsResponse } from '@/lib/types/jobs';
import { Duration, Notice, StateBadge, tdClass, thClass, When } from './parts';

/** Every job with its schedule, state and last run; filtered by text and state. */
export function JobsList({ data }: { data: JobsResponse }) {
  const t = useTranslations('Jobs');
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<JobFilter>('all');

  if (!data.available) {
    return (
      <Notice tone="warning">
        <p className="font-semibold">{t('unreachable.title')}</p>
        <p>{data.base_url_configured ? t('unreachable.body') : t('unreachable.notConfigured')}</p>
      </Notice>
    );
  }
  if (data.jobs.length === 0) {
    return (
      <div className="flex h-48 flex-col items-center justify-center text-gray-500">
        <Workflow className="mb-3 h-10 w-10 opacity-50" />
        <p>{t('list.empty')}</p>
      </div>
    );
  }

  const shown = filterJobs(data.jobs, text, filter);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-60">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('list.search')}
            aria-label={t('list.search')}
            className="theme-input w-full rounded-lg py-2 pl-9 pr-3 text-sm"
          />
        </label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as JobFilter)}
          aria-label={t('list.stateFilter')}
          className="theme-input rounded-lg px-3 py-2 text-sm"
        >
          {JOB_FILTERS.map((f) => (
            <option key={f} value={f}>{t(`list.filter.${f}`)}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">{t('list.count', { shown: shown.length, total: data.jobs.length })}</span>
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-gray-500">{t('list.noMatch')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="jobs-table">
            <thead>
              <tr className="border-b border-white/10">
                <th className={thClass}>{t('list.columns.job')}</th>
                <th className={thClass}>{t('list.columns.status')}</th>
                <th className={thClass}>{t('list.columns.schedule')}</th>
                <th className={thClass}>{t('list.columns.nextRun')}</th>
                <th className={thClass}>{t('list.columns.lastRun')}</th>
                <th className={thClass}>{t('list.columns.lastRunTime')}</th>
                <th className={thClass}>{t('list.columns.duration')}</th>
                <th className={thClass}>{t('list.columns.tags')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {shown.map((job) => (
                <tr key={job.id} className="hover:bg-white/5" data-testid={`job-row-${job.id}`}>
                  <td className={tdClass}>
                    <Link href={jobsHref({ job: job.id })} className="font-mono text-blue-400 hover:underline">
                      {job.name}
                    </Link>
                    {job.description && <div className="text-xs text-gray-500">{job.description}</div>}
                  </td>
                  <td className={tdClass}>
                    <div className="flex flex-col gap-1">
                      {job.paused ? (
                        <span className="inline-flex items-center gap-1 text-gray-400">
                          <Pause className="h-3.5 w-3.5" />
                          {t('status.paused')}
                        </span>
                      ) : (
                        <span className="text-green-400">{t('status.active')}</span>
                      )}
                      {job.has_load_errors && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400" title={t('status.loadErrorsHelp')}>
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {t('status.loadErrors')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className={`${tdClass} font-mono text-gray-400`}>{job.schedule ?? '—'}</td>
                  <td className={`${tdClass} text-gray-400`}><When iso={job.next_run} /></td>
                  <td className={tdClass}><StateBadge state={job.last_run?.state ?? null} /></td>
                  <td className={`${tdClass} text-gray-400`}>
                    <When iso={job.last_run ? job.last_run.start ?? job.last_run.run_after : null} />
                  </td>
                  <td className={`${tdClass} text-gray-400`}><Duration seconds={job.last_run?.duration_s ?? null} /></td>
                  <td className={tdClass}>
                    <div className="flex flex-wrap gap-1">
                      {job.tags.map((tag) => (
                        <span key={tag} className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-gray-400">{tag}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
