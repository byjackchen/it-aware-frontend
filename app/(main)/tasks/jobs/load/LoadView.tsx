'use client';

/**
 * Manage Jobs, Load: the frame with the 7/30/90-day selector, the stat tiles,
 * the four charts and the table of jobs.
 */

import { useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, BarChart3, RefreshCw } from 'lucide-react';
import { GroupBarCard } from '@/components/ops_dashboard/GroupBarCard';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { StackedBarPercentLineCard } from '@/components/ops_dashboard/StackedBarPercentLineCard';
import {
  barFloor,
  dailyRows,
  DEFAULT_LOAD_SORT,
  formatFailureRate,
  hourlyRows,
  loadHref,
  loadScreen,
  LOAD_WINDOWS,
  nextLoadSort,
  sortLoadJobs,
  TOP_JOBS,
  topJobs,
  type LoadDays,
  type LoadSortKey,
} from '@/lib/jobs/load';
import { jobsHref } from '@/lib/jobs/paths';
import { formatDuration } from '@/lib/jobs/view';
import type { GroupCount } from '@/lib/ops_dashboard/aggregate';
import type { JobsLoad, LoadUnavailable } from '@/lib/types/jobs';
import { CHART_COLOR, Duration, Notice, tdClass } from '../parts';

interface LoadFrameProps {
  days: LoadDays;
  /** The window the backend used, once it answered. */
  range?: { start: string; end: string };
  children: ReactNode;
}

export function LoadFrame({ days, range, children }: LoadFrameProps) {
  const t = useTranslations('Jobs');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="p-4">
      <div className="glass-card rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="h-5 w-5 text-accent" />
            <div>
              <h1 className="text-xl font-semibold theme-text-primary">{t('load.title')}</h1>
              <p className="text-xs text-muted">{t('load.help')}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end gap-1">
              <nav className="flex gap-1" aria-label={t('load.window.label')}>
                {LOAD_WINDOWS.map((option) => (
                  <Link
                    key={option}
                    href={loadHref(option)}
                    aria-current={option === days ? 'page' : undefined}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${option === days ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-hover'}`}
                  >
                    {t('load.window.days', { days: option })}
                  </Link>
                ))}
              </nav>
              {range && (
                <span className="text-xs text-muted" data-testid="load-window">
                  {t('load.window.dates', { start: range.start, end: range.end })}
                </span>
              )}
            </div>
            <button
              onClick={() => startTransition(() => router.refresh())}
              disabled={pending}
              className="flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-1.5 text-accent hover:bg-hover disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">{t('refresh')}</span>
            </button>
          </div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

const COLUMNS: LoadSortKey[] = ['job', 'runs', 'failed', 'run_seconds', 'average_seconds', 'longest_seconds'];

/** A header cell; a column of numbers is headed on the right, over its numbers. */
const th = (key: LoadSortKey) =>
  `px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-2 ${key === 'job' ? 'text-left' : 'text-right'}`;

function JobsTable({ jobs }: { jobs: JobsLoad['jobs'] }) {
  const t = useTranslations('Jobs.load.table');
  const locale = useLocale();
  const [sort, setSort] = useState(DEFAULT_LOAD_SORT);
  const Arrow = sort.direction === 'ascending' ? ArrowUp : ArrowDown;
  return (
    <div className="mt-4">
      <h2 className="mb-2 font-semibold theme-text-primary">{t('title')}</h2>
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="load-jobs-table">
          <thead>
            <tr className="border-b border-line">
              {COLUMNS.map((key) => {
                const active = sort.key === key;
                return (
                  <th key={key} className={th(key)} aria-sort={active ? sort.direction : 'none'}>
                    <button
                      onClick={() => setSort(nextLoadSort(sort, key))}
                      className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink ${active ? 'text-ink' : ''}`}
                    >
                      {t(`columns.${key}`)}
                      {active && <Arrow className="h-3 w-3" />}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sortLoadJobs(jobs, sort, locale).map((row) => (
              <tr key={row.job} className="hover:bg-hover" data-testid={`load-job-row-${row.job}`}>
                <td className={tdClass}>
                  <Link href={jobsHref({ job: row.job })} className="font-mono text-accent hover:underline">{row.job}</Link>
                </td>
                <td className={`${tdClass} text-right theme-text-primary`} data-testid="load-job-runs">{row.runs.toLocaleString(locale)}</td>
                <td className={`${tdClass} text-right ${row.failed > 0 ? 'text-bad' : 'theme-text-primary'}`}>{row.failed.toLocaleString(locale)}</td>
                <td className={`${tdClass} text-right theme-text-primary`}><Duration seconds={row.run_seconds} /></td>
                <td className={`${tdClass} text-right theme-text-primary`}><Duration seconds={row.average_seconds} /></td>
                <td className={`${tdClass} text-right theme-text-primary`}><Duration seconds={row.longest_seconds} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** A duration as text, in the jobs task's own format; a dash for none. */
const duration = (seconds: number | null) => formatDuration(seconds) ?? '—';

export function LoadView({ answer }: { answer: JobsLoad | LoadUnavailable }) {
  const t = useTranslations('Jobs');
  const locale = useLocale();
  const screen = loadScreen(answer);

  if (screen.kind === 'unavailable') {
    return (
      <Notice tone="warning">
        <p className="font-semibold">{t('unreachable.title')}</p>
        <p>{screen.configured ? t('unreachable.body') : t('unreachable.notConfigured')}</p>
      </Notice>
    );
  }

  const data = screen.load;
  const { totals } = data;
  const daily = dailyRows(data.daily);
  const hourly = hourlyRows(data.hourly);
  const top = topJobs(data.jobs);
  const rate = formatFailureRate(totals.failed, totals.runs);
  const xInterval = data.daily.length > 14 ? 'preserveStartEnd' : 0;
  return (
    <>
      {screen.partial !== null && (
        <Notice tone="warning">
          <span data-testid="load-partial">{t('load.partial', { count: screen.partial })}</span>
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <div data-testid="load-stat-runs">
          <KpiCard label={t('load.tiles.runs')} value={totals.runs.toLocaleString(locale)} className="h-full" />
        </div>
        <div data-testid="load-stat-failed">
          <KpiCard
            label={t('load.tiles.failed')}
            value={totals.failed.toLocaleString(locale)}
            subtitle={rate === null ? undefined : t('load.tiles.failureRate', { rate })}
            valueColor={totals.failed > 0 ? 'text-bad' : undefined}
            className="h-full"
          />
        </div>
        <div data-testid="load-stat-runTime">
          <KpiCard label={t('load.tiles.runTime')} value={duration(totals.run_seconds)} className="h-full" />
        </div>
        <div data-testid="load-stat-average">
          <KpiCard label={t('load.tiles.average')} value={duration(totals.average_seconds)} className="h-full" />
        </div>
        <div data-testid="load-stat-longest">
          <KpiCard
            label={t('load.tiles.longest')}
            value={duration(totals.longest?.seconds ?? null)}
            subtitle={
              totals.longest && (
                <Link href={jobsHref({ job: totals.longest.job })} className="font-mono text-accent hover:underline">
                  {totals.longest.job}
                </Link>
              )
            }
            className="h-full"
          />
        </div>
      </div>

      {screen.kind === 'empty' ? (
        <div className="flex h-48 flex-col items-center justify-center text-center text-muted" data-testid="load-empty">
          <BarChart3 className="mb-3 h-10 w-10 opacity-50" />
          <p className="font-medium text-ink-2">{t('load.empty.title')}</p>
          <p className="text-sm">{t('load.empty.body', { days: data.days })}</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div data-testid="load-chart-runs">
              <StackedBarPercentLineCard
                title={t('load.charts.runsPerDay')}
                subtitle={t('load.charts.runsPerDayHelp')}
                data={daily.rows}
                xKey="label"
                xInterval={xInterval}
                minPointSize={barFloor}
                maxBarSize={48}
                allowDecimals={false}
                height={260}
                stackedKeys={[
                  { key: 'success', label: t('load.charts.success'), color: CHART_COLOR.good },
                  { key: 'failed', label: t('load.charts.failed'), color: CHART_COLOR.bad },
                  { key: 'other', label: t('load.charts.other'), color: CHART_COLOR.other },
                ]}
              />
            </div>
            <div data-testid="load-chart-time">
              <StackedBarPercentLineCard
                title={t('load.charts.timePerDay')}
                subtitle={t('load.charts.timePerDayHelp', { unit: t(`load.unit.${daily.unit}`) })}
                data={daily.rows}
                xKey="label"
                xInterval={xInterval}
                minPointSize={barFloor}
                maxBarSize={48}
                showLegend={false}
                height={260}
                stackedKeys={[{ key: 'run_time', label: t('load.charts.runTime'), color: CHART_COLOR.time }]}
                formatValue={(_value, row) => duration(Number(row.run_seconds))}
              />
            </div>
            <div data-testid="load-chart-hours">
              <StackedBarPercentLineCard
                title={t('load.charts.byHour')}
                subtitle={t('load.charts.byHourHelp', { unit: t(`load.unit.${hourly.unit}`) })}
                data={hourly.rows}
                xKey="label"
                minPointSize={barFloor}
                maxBarSize={48}
                showLegend={false}
                height={260}
                stackedKeys={[{ key: 'run_time', label: t('load.charts.runTime'), color: CHART_COLOR.time }]}
                formatValue={(_value, row) =>
                  t('load.charts.hourValue', { time: duration(Number(row.run_seconds)), runs: Number(row.runs) })
                }
              />
            </div>
            <div data-testid="load-chart-jobs">
              <GroupBarCard
                title={t('load.charts.topJobs')}
                subtitle={t('load.charts.topJobsHelp', { count: TOP_JOBS, unit: t(`load.unit.${top.unit}`) })}
                data={top.rows.map((row) => ({ key: row.job, count: row.run_time, run_seconds: row.run_seconds }))}
                color={CHART_COLOR.time}
                yAxisWidth={220}
                minPointSize={barFloor(1)}
                emptyText={t('load.charts.noTime')}
                formatValue={(row) => duration((row as GroupCount & { run_seconds: number }).run_seconds)}
              />
            </div>
          </div>
          <JobsTable jobs={data.jobs} />
        </>
      )}
    </>
  );
}
