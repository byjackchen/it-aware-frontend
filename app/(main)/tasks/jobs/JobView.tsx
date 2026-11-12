'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { pauseJob, resumeJob, runJob } from '@/app/actions/jobs';
import { jobsHref, RUNS_PAGE_SIZE } from '@/lib/jobs/paths';
import { parameterFields, parameterValues, type ParameterField } from '@/lib/jobs/view';
import type { JobDetail, RunsResponse } from '@/lib/types/jobs';
import { ActionButton, Duration, Pager, StateBadge, tdClass, thClass, useJobActions, When } from './parts';

type FormValues = Record<string, string | boolean>;

/** The run-now form: one field per parameter the job defines. */
function RunNowForm({ fields, valuesRef }: { fields: ParameterField[]; valuesRef: React.RefObject<FormValues> }) {
  const t = useTranslations('Jobs.actions');
  const [shown, setShown] = useState<FormValues>(() => Object.fromEntries(fields.map((f) => [f.name, f.initial])));
  const set = (name: string, value: string | boolean) => {
    valuesRef.current = { ...valuesRef.current, [name]: value };
    setShown((s) => ({ ...s, [name]: value }));
  };
  if (fields.length === 0) return <p className="text-sm text-gray-500">{t('noParameters')}</p>;
  return (
    <fieldset className="space-y-3" data-testid="run-now-form">
      <legend className="mb-1 text-sm font-medium text-gray-300">{t('parameters')}</legend>
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="mb-1 block font-mono text-sm text-gray-300">{f.name}</span>
          {f.kind === 'boolean' ? (
            <input type="checkbox" checked={shown[f.name] === true} onChange={(e) => set(f.name, e.target.checked)} />
          ) : (
            <input
              type={f.kind === 'integer' || f.kind === 'number' ? 'number' : 'text'}
              step={f.kind === 'number' ? 'any' : undefined}
              value={String(shown[f.name])}
              onChange={(e) => set(f.name, e.target.value)}
              className="theme-input w-full rounded-lg px-3 py-2 text-sm"
            />
          )}
          {f.description && <span className="mt-1 block text-xs text-gray-500">{f.description}</span>}
        </label>
      ))}
    </fieldset>
  );
}

/** One job: what it is, its controls, and its runs (paged). */
export function JobView({ job, runs, page }: { job: JobDetail; runs: RunsResponse; page: number }) {
  const t = useTranslations('Jobs');
  const { canRun, ask, busy, unavailable, view } = useJobActions();
  const fields = parameterFields(job.parameters);
  const formValuesRef = useRef<FormValues>({});

  const askRun = () => {
    formValuesRef.current = {};
    ask({
      key: 'run',
      question: t('actions.confirmRun', { job: job.name }),
      body: <RunNowForm fields={fields} valuesRef={formValuesRef} />,
      prepare: () => {
        const parsed = parameterValues(fields, formValuesRef.current);
        if (!parsed.ok) return t('actions.invalidParameters', { names: parsed.invalid.join(', ') });
        return () => runJob(job.id, parsed.values);
      },
    });
  };

  const facts: [string, React.ReactNode][] = [
    [t('job.status'), job.paused ? t('status.paused') : t('status.active')],
    [t('job.schedule'), <span key="s" className="font-mono">{job.schedule ?? '—'}</span>],
    [t('job.nextRun'), <When key="n" iso={job.next_run} />],
    [t('job.lastRun'), <StateBadge key="l" state={job.last_run?.state ?? null} empty={t('status.noRun')} />],
    [t('job.tags'), job.tags.join(', ') || '—'],
  ];

  return (
    <>
      <Link href={jobsHref()} className="mb-3 inline-flex items-center gap-1 text-sm text-blue-400 hover:underline">
        <ArrowLeft className="h-4 w-4" />
        {t('allJobs')}
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-lg font-semibold theme-text-primary">{job.name}</h2>
          {job.name !== job.id && <p className="font-mono text-xs text-gray-500">{job.id}</p>}
          {job.description && <p className="text-sm text-gray-400">{job.description}</p>}
          {job.has_load_errors && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-red-400">
              <AlertTriangle className="h-4 w-4" />
              {t('status.loadErrorsHelp')}
            </p>
          )}
        </div>
        {canRun && (
          <div className="flex flex-wrap items-start gap-2" data-testid="job-actions">
            {job.paused ? (
              <ActionButton
                busy={busy}
                label={t('actions.resume')}
                refusal={unavailable.resume}
                onClick={() =>
                  ask({ key: 'resume', question: t('actions.confirmResume', { job: job.name }), prepare: () => () => resumeJob(job.id) })
                }
              />
            ) : (
              <ActionButton
                busy={busy}
                label={t('actions.pause')}
                refusal={unavailable.pause}
                onClick={() =>
                  ask({ key: 'pause', question: t('actions.confirmPause', { job: job.name }), prepare: () => () => pauseJob(job.id) })
                }
              />
            )}
            <ActionButton
              busy={busy}
              label={t('actions.run')}
              refusal={
                job.manual_run_allowed
                  ? unavailable.run
                  : t('actions.runRefused', { reason: job.manual_run_refusal ?? '—' })
              }
              onClick={askRun}
            />
          </div>
        )}
      </div>
      {view}
      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-5">
        {facts.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-gray-500">{label}</dt>
            <dd className="theme-text-primary">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold theme-text-primary">{t('job.runs')}</h3>
        <Link href={jobsHref({ tab: 'actions', job: job.id })} className="text-sm text-blue-400 hover:underline">
          {t('job.recordLink')}
        </Link>
      </div>
      {runs.runs.length === 0 ? (
        <p className="py-6 text-center text-gray-500">{t('job.runsEmpty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="runs-table">
            <thead>
              <tr className="border-b border-white/10">
                <th className={thClass}>{t('job.columns.run')}</th>
                <th className={thClass}>{t('job.columns.state')}</th>
                <th className={thClass}>{t('job.columns.type')}</th>
                <th className={thClass}>{t('job.columns.runAfter')}</th>
                <th className={thClass}>{t('job.columns.start')}</th>
                <th className={thClass}>{t('job.columns.end')}</th>
                <th className={thClass}>{t('job.columns.duration')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {runs.runs.map((run) => (
                <tr key={run.id} className="hover:bg-white/5">
                  <td className={tdClass}>
                    <Link href={jobsHref({ job: job.id, run: run.id })} className="font-mono text-blue-400 hover:underline">
                      {run.id}
                    </Link>
                  </td>
                  <td className={tdClass}><StateBadge state={run.state} /></td>
                  <td className={`${tdClass} text-gray-400`}>{run.run_type ?? '—'}</td>
                  <td className={`${tdClass} text-gray-400`}><When iso={run.run_after} /></td>
                  <td className={`${tdClass} text-gray-400`}><When iso={run.start} /></td>
                  <td className={`${tdClass} text-gray-400`}><When iso={run.end} /></td>
                  <td className={`${tdClass} text-gray-400`}><Duration seconds={run.duration_s} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={runs.total} size={RUNS_PAGE_SIZE} link={{ job: job.id }} />
    </>
  );
}
