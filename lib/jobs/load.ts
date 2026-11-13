/**
 * Manage Jobs, Load: where the view lives, how its window is read from the
 * address, and what its tiles, charts and table are made of (GET /jobs/load).
 *
 *   /tasks/jobs/load[?days=7|30|90]
 */

import { JOBS_BASE } from '@/lib/jobs/paths';
import { stateTone } from '@/lib/jobs/view';
import type { LoadDay, LoadHour, LoadJob, RunSummary } from '@/lib/types/jobs';

// ── The window and the address ───────────────────────────────────────────────

/** The windows the backend accepts, in UTC days. */
export const LOAD_WINDOWS = [7, 30, 90] as const;
export type LoadDays = (typeof LOAD_WINDOWS)[number];
export const DEFAULT_LOAD_DAYS: LoadDays = 7;

/** The window the address asks for; the default for none or one the backend would refuse. */
export function parseLoadDays(params: Record<string, string | string[] | undefined>): LoadDays {
  const value = params.days;
  const asked = Number(Array.isArray(value) ? value[0] : value);
  return LOAD_WINDOWS.find((days) => days === asked) ?? DEFAULT_LOAD_DAYS;
}

/** The view's address; the default window is left out. */
export function loadHref(days: number = DEFAULT_LOAD_DAYS): string {
  return days === DEFAULT_LOAD_DAYS ? `${JOBS_BASE}/load` : `${JOBS_BASE}/load?days=${days}`;
}

// ── Numbers ──────────────────────────────────────────────────────────────────

/** The failed runs as a share of all runs, `0.7%`; a dash when there were no runs. */
export function formatFailureRate(failed: number, runs: number): string {
  return runs > 0 ? `${((failed / runs) * 100).toFixed(1)}%` : '—';
}

/** The unit a chart's run times are drawn in. */
export type DurationUnit = 's' | 'min' | 'h';

const UNIT_SECONDS: Record<DurationUnit, number> = { s: 1, min: 60, h: 3600 };

/** The unit that keeps a chart's axis in small numbers: seconds up to two minutes, minutes up to two hours, then hours. */
export function durationUnit(longestSeconds: number): DurationUnit {
  if (longestSeconds < 120) return 's';
  return longestSeconds < 7200 ? 'min' : 'h';
}

/** Seconds in a unit, to one decimal. */
export function inUnit(seconds: number, unit: DurationUnit): number {
  return Math.round((seconds / UNIT_SECONDS[unit]) * 10) / 10;
}

function unitOf(seconds: number[]): DurationUnit {
  return durationUnit(Math.max(0, ...seconds));
}

// ── Charts ───────────────────────────────────────────────────────────────────

/** A chart's rows with the unit their `run_time` is in; `run_seconds` stays for the tooltip. */
export interface Timed<Row> {
  unit: DurationUnit;
  rows: (Row & { run_time: number })[];
}

function timed<Row extends { run_seconds: number }>(rows: Row[]): Timed<Row> {
  const unit = unitOf(rows.map((row) => row.run_seconds));
  return { unit, rows: rows.map((row) => ({ ...row, run_time: inUnit(row.run_seconds, unit) })) };
}

/** The days as the two daily charts draw them: labelled `MM-DD`, in the order given (oldest first). */
export function dailyRows(daily: LoadDay[]): Timed<LoadDay & { label: string }> {
  return timed(daily.map((day) => ({ ...day, label: day.date.slice(5) })));
}

/** The 24 hours as the hourly chart draws them: labelled `00` … `23`. */
export function hourlyRows(hourly: LoadHour[]): Timed<LoadHour & { label: string }> {
  return timed(hourly.map((hour) => ({ ...hour, label: String(hour.hour).padStart(2, '0') })));
}

/** How many jobs the chart of jobs by time consumed shows. */
export const TOP_JOBS = 10;

/** The jobs that took the most run time, most first; a job that took none is left out. */
export function topJobs(jobs: LoadJob[], count: number = TOP_JOBS): Timed<LoadJob> {
  const top = jobs
    .filter((job) => job.run_seconds > 0)
    .sort((a, b) => b.run_seconds - a.run_seconds)
    .slice(0, count);
  return timed(top);
}

/** One run as the job page's chart draws it: its run time under `ok` or `failed`, so a failed run is drawn apart. */
export interface RunBar {
  run: string;
  start: string | null;
  state: string | null;
  duration_s: number;
  ok: number | null;
  failed: number | null;
}

/**
 * The runs a job's page loaded as its duration chart draws them: oldest first
 * (the backend lists newest first), without the runs that have no duration yet.
 */
export function runBars(runs: RunSummary[]): { unit: DurationUnit; rows: RunBar[] } {
  const done = runs.filter((run): run is RunSummary & { duration_s: number } => run.duration_s !== null).reverse();
  const unit = unitOf(done.map((run) => run.duration_s));
  return {
    unit,
    rows: done.map((run) => {
      const time = inUnit(run.duration_s, unit);
      const failed = stateTone(run.state) === 'failed';
      return {
        run: run.id,
        start: run.start,
        state: run.state,
        duration_s: run.duration_s,
        ok: failed ? null : time,
        failed: failed ? time : null,
      };
    }),
  };
}

// ── The table of jobs ────────────────────────────────────────────────────────

export type LoadSortKey = 'job' | 'runs' | 'failed' | 'run_seconds' | 'average_seconds' | 'longest_seconds';
export interface LoadSort {
  key: LoadSortKey;
  direction: 'ascending' | 'descending';
}

/** As the backend orders them: the most run time first. */
export const DEFAULT_LOAD_SORT: LoadSort = { key: 'run_seconds', direction: 'descending' };

/** The sort after a click on a column: the other direction on the same column; else names A to Z, numbers largest first. */
export function nextLoadSort(current: LoadSort, key: LoadSortKey): LoadSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'ascending' ? 'descending' : 'ascending' };
  }
  return { key, direction: key === 'job' ? 'ascending' : 'descending' };
}

/** The jobs sorted. A missing average or longest comes last in both directions; equal jobs keep the order given. */
export function sortLoadJobs(jobs: LoadJob[], sort: LoadSort): LoadJob[] {
  const sign = sort.direction === 'ascending' ? 1 : -1;
  return [...jobs].sort((a, b) => {
    const x = a[sort.key];
    const y = b[sort.key];
    if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
    return sign * (typeof x === 'string' ? x.localeCompare(String(y)) : x - Number(y));
  });
}
