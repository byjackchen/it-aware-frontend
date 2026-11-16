'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { pauseJob, resumeJob, runJob } from '@/app/actions/jobs';
import { StackedBarPercentLineCard } from '@/components/ops_dashboard/StackedBarPercentLineCard';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { barFloor, runBars } from '@/lib/jobs/load';
import { jobsHref, RUNS_PAGE_SIZE } from '@/lib/jobs/paths';
import { formatDuration, parameterFields, parameterValues, type ParameterField } from '@/lib/jobs/view';
import { formatLocalDateTime } from '@/lib/utils/datetime';
import type { JobDetail, RunsResponse, RunSummary } from '@/lib/types/jobs';
import { ActionButton, CHART_COLOR, Duration, Pager, StateBadge, tdClass, thClass, useJobActions, When } from './parts';

type FormValues = Record<string, string | boolean>;

/** The run-now form: one field per parameter the job defines. */
function RunNowForm({ fields, valuesRef }: { fields: ParameterField[]; valuesRef: React.RefObject<FormValues> }) {
  const t = useTranslations('Jobs.actions');
  const [shown, setShown] = useState<FormValues>(() => Object.fromEntries(fields.map((f) => [f.name, f.initial])));
  const set = (name: string, value: string | boolean) => {
    valuesRef.current = { ...valuesRef.current, [name]: value };
    setShown((s) => ({ ...s, [name]: value }));
  };
  if (fields.length === 0) return <p className="text-sm text-muted">{t('noParameters')}</p>;
  return (
    <fieldset className="space-y-3" data-testid="run-now-form">
      <legend className="mb-1 text-sm font-medium text-ink-2">{t('parameters')}</legend>
      {fields.map((f) => (
        <label key={f.name} className="block">
          <span className="mb-1 block font-mono text-sm text-ink-2">{f.name}</span>
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
          {f.description && <span className="mt-1 block text-xs text-muted">{f.description}</span>}
        </label>
      ))}
    </fieldset>
  );
}

/** How long the job's newest runs took, oldest first, a failed run in its own colour. Nothing while no run has ended. */
function RunDurations({ runs }: { runs: RunSummary[] }) {
  const t = useTranslations('Jobs.load');
  const { timezone } = useTimezone();
  const { unit, rows } = runBars(runs);
  if (rows.length === 0) return null;
  return (
    <div className="mb-4" data-testid="run-durations">
      <StackedBarPercentLineCard
        title={t('runDurations.title')}
        subtitle={t('runDurations.help', { count: rows.length, unit: t(`unit.${unit}`) })}
        data={rows.map((row) => ({ ...row, label: formatLocalDateTime(row.start, timezone).replace('T', ' ').slice(5, 16) }))}
        xKey="label"
        xInterval="preserveStartEnd"
        minPointSize={barFloor}
        maxBarSize={48}
        height={200}
        stackedKeys={[
          { key: 'ok', label: t('runDurations.ok'), color: CHART_COLOR.time },
          { key: 'failed', label: t('runDurations.failed'), color: CHART_COLOR.bad },
        ]}
        formatValue={(_value, row) => formatDuration(Number(row.duration_s)) ?? '—'}
      />
    </div>
  );
}

/** One job: what it is, its controls, and its runs (paged). */
export function JobView({ job, runs, newest, page }: { job: JobDetail; runs: RunsResponse; newest: RunSummary[]; page: number }) {
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
      <Link href={jobsHref()} className="mb-3 inline-flex items-center gap-1 text-sm text-accent hover:underline">
        <ArrowLeft className="h-4 w-4" />
        {t('allJobs')}
      </Link>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-mono text-lg font-semibold theme-text-primary">{job.name}</h2>
          {job.name !== job.id && <p className="font-mono text-xs text-muted">{job.id}</p>}
          {job.description && <p className="text-sm text-ink-2">{job.description}</p>}
          {job.has_load_errors && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-bad">
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
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="theme-text-primary">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold theme-text-primary">{t('job.runs')}</h3>
        <Link href={jobsHref({ tab: 'actions', job: job.id })} className="text-sm text-accent hover:underline">
          {t('job.recordLink')}
        </Link>
      </div>
      <RunDurations runs={newest} />
      {runs.runs.length === 0 ? (
        <p className="py-6 text-center text-muted">{t('job.runsEmpty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="runs-table">
            <thead>
              <tr className="border-b border-line">
                <th className={thClass}>{t('job.columns.run')}</th>
                <th className={thClass}>{t('job.columns.state')}</th>
                <th className={thClass}>{t('job.columns.type')}</th>
                <th className={thClass}>{t('job.columns.runAfter')}</th>
                <th className={thClass}>{t('job.columns.start')}</th>
                <th className={thClass}>{t('job.columns.end')}</th>
                <th className={thClass}>{t('job.columns.duration')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {runs.runs.map((run) => (
                <tr key={run.id} className="hover:bg-hover">
                  <td className={tdClass}>
                    <Link href={jobsHref({ job: job.id, run: run.id })} className="font-mono text-accent hover:underline">
                      {run.id}
                    </Link>
                  </td>
                  <td className={tdClass}><StateBadge state={run.state} /></td>
                  <td className={`${tdClass} text-ink-2`}>{run.run_type ?? '—'}</td>
                  <td className={`${tdClass} text-ink-2`}><When iso={run.run_after} /></td>
                  <td className={`${tdClass} text-ink-2`}><When iso={run.start} /></td>
                  <td className={`${tdClass} text-ink-2`}><When iso={run.end} /></td>
                  <td className={`${tdClass} text-ink-2`}><Duration seconds={run.duration_s} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={runs.total} size={RUNS_PAGE_SIZE} href={(to) => jobsHref({ job: job.id, page: to })} />
    </>
  );
}
