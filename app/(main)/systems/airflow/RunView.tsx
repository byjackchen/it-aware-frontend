'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Loader2, X } from 'lucide-react';
import { readStepLog, retryFailed, stopRun } from '@/app/actions/jobs';
import { jobsHref } from '@/lib/jobs/paths';
import { appendLog, hasFailedSteps, isUnfinished, logTries } from '@/lib/jobs/view';
import type { Job, JobsFailure, RunDetail, StepLog } from '@/lib/types/jobs';
import { ActionButton, Duration, StateBadge, tdClass, thClass, useJobActions, When } from './parts';

export interface OpenStep {
  id: string;
  try: number;
  map: number;
  log: { ok: true; data: StepLog } | { ok: false; failure: JobsFailure };
}

/** One try of one step's log, read on with "load more" while it has a next part. */
function StepLogPanel({ job, run, step }: { job: Job; run: RunDetail; step: OpenStep }) {
  const t = useTranslations('Jobs.log');
  const first = step.log.ok ? step.log.data : null;
  const [log, setLog] = useState(first);
  const [error, setError] = useState<string | null>(step.log.ok ? null : step.log.failure.message);
  const [pending, startTransition] = useTransition();
  const stepName = run.steps.find((s) => s.id === step.id)?.name ?? step.id;

  const loadMore = () => {
    const token = log?.next_token;
    if (!log || !token) return;
    startTransition(async () => {
      const next = await readStepLog(job.id, run.id, step.id, step.try, step.map, token);
      if (next.ok) {
        setLog({ ...log, ...appendLog(log, next.data) });
        setError(null);
      } else {
        setError(next.failure.message);
      }
    });
  };

  return (
    <section className="mt-6 rounded-lg border border-white/10" data-testid="step-log">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <h3 className="font-semibold theme-text-primary">{t('title', { step: stepName, try: step.try })}</h3>
        <Link href={jobsHref({ job: job.id, run: run.id })} className="text-gray-400 hover:text-white" aria-label={t('close')}>
          <X className="h-4 w-4" />
        </Link>
      </div>
      {log?.truncated && <p className="px-4 pt-3 text-xs text-amber-400">{t('truncated')}</p>}
      {error && <p role="alert" className="px-4 pt-3 text-sm text-red-400">{t('failed', { message: error })}</p>}
      {log && (
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-all p-4 font-mono text-xs theme-text-primary">
          {log.content || t('empty')}
        </pre>
      )}
      {log?.next_token && (
        <div className="border-t border-white/10 px-4 py-2">
          <button
            onClick={loadMore}
            disabled={pending}
            className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-1.5 text-sm text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('loadMore')}
          </button>
        </div>
      )}
    </section>
  );
}

/** One run: its steps, each step's log by try, and its recovery actions. */
export function RunView({ job, run, step }: { job: Job; run: RunDetail; step: OpenStep | null }) {
  const t = useTranslations('Jobs');
  const { canRun, ask, unavailable, view } = useJobActions();
  const offerRetry = hasFailedSteps(run, run.steps);
  const offerStop = isUnfinished(run);
  const parameters = Object.entries(run.parameters);

  return (
    <>
      <Link href={jobsHref({ job: job.id })} className="mb-3 inline-flex items-center gap-1 text-sm text-blue-400 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        {job.name}
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-lg font-semibold theme-text-primary">{t('run.title', { run: run.id })}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-400">
            <StateBadge state={run.state} />
            <span>{run.run_type ?? '—'}</span>
            <span><When iso={run.start} /> → <When iso={run.end} /></span>
            <Duration seconds={run.duration_s} />
          </div>
        </div>
        {canRun && (offerRetry || offerStop) && (
          <div className="flex flex-wrap items-start gap-2" data-testid="run-actions">
            {offerRetry && (
              <ActionButton
                label={t('actions.retry_failed')}
                refusal={
                  job.retry_failed_allowed
                    ? unavailable.retry_failed
                    : t('actions.retryRefused', { reason: job.retry_failed_refusal ?? '—' })
                }
                onClick={() =>
                  ask({
                    key: 'retry_failed',
                    question: t('actions.confirmRetry', { job: job.name, run: run.id }),
                    prepare: () => () => retryFailed(job.id, run.id),
                  })
                }
              />
            )}
            {offerStop && (
              <ActionButton
                label={t('actions.stop')}
                tone="danger"
                refusal={unavailable.stop}
                onClick={() =>
                  ask({
                    key: 'stop',
                    question: t('actions.confirmStop', { job: job.name, run: run.id }),
                    prepare: () => () => stopRun(job.id, run.id),
                  })
                }
              />
            )}
          </div>
        )}
      </div>
      {view}

      <h3 className="mb-1 text-sm font-semibold text-gray-300">{t('run.parameters')}</h3>
      {parameters.length === 0 ? (
        <p className="mb-4 text-sm text-gray-500">{t('run.noParameters')}</p>
      ) : (
        <dl className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {parameters.map(([name, value]) => (
            <div key={name} className="font-mono">
              <dt className="inline text-gray-500">{name}=</dt>
              <dd className="inline theme-text-primary">{JSON.stringify(value)}</dd>
            </div>
          ))}
        </dl>
      )}

      <h3 className="mb-2 font-semibold theme-text-primary">{t('run.steps')}</h3>
      {run.steps.length === 0 ? (
        <p className="py-6 text-center text-gray-500">{t('run.noSteps')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="steps-table">
            <thead>
              <tr className="border-b border-white/10">
                <th className={thClass}>{t('run.columns.step')}</th>
                <th className={thClass}>{t('run.columns.state')}</th>
                <th className={thClass}>{t('run.columns.start')}</th>
                <th className={thClass}>{t('run.columns.end')}</th>
                <th className={thClass}>{t('run.columns.duration')}</th>
                <th className={thClass}>{t('run.columns.try')}</th>
                <th className={thClass}>{t('run.columns.log')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {run.steps.map((s) => {
                const tries = logTries(s);
                return (
                  <tr key={`${s.id}:${s.map_index}`} className="hover:bg-white/5" data-testid={`step-row-${s.id}`}>
                    <td className={tdClass}>
                      <span className="theme-text-primary">{s.name}</span>
                      {s.map_index >= 0 && <span className="ml-1 text-xs text-gray-500">[{s.map_index}]</span>}
                    </td>
                    <td className={tdClass}><StateBadge state={s.state} /></td>
                    <td className={`${tdClass} text-gray-400`}><When iso={s.start} /></td>
                    <td className={`${tdClass} text-gray-400`}><When iso={s.end} /></td>
                    <td className={`${tdClass} text-gray-400`}><Duration seconds={s.duration_s} /></td>
                    <td className={`${tdClass} text-gray-400`}>{s.try_number}</td>
                    <td className={tdClass}>
                      {tries.length === 0 ? (
                        <span className="text-xs text-gray-500">{t('run.noLog')}</span>
                      ) : (
                        <span className="flex flex-wrap gap-2">
                          {tries.map((n) => (
                            <Link
                              key={n}
                              href={jobsHref({ job: job.id, run: run.id, step: s.id, try: n, map: s.map_index })}
                              className="text-xs text-blue-400 hover:underline"
                            >
                              {t('run.tryLink', { n })}
                            </Link>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {step && <StepLogPanel key={`${step.id}:${step.try}:${step.map}`} job={job} run={run} step={step} />}
    </>
  );
}
