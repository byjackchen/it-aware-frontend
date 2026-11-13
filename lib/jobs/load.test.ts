import { describe, expect, it } from 'vitest';
import {
  dailyRows,
  DEFAULT_LOAD_SORT,
  durationUnit,
  barFloor,
  formatFailureRate,
  hourlyRows,
  inUnit,
  loadHref,
  loadScreen,
  nextLoadSort,
  parseLoadDays,
  runBars,
  sortLoadJobs,
  topJobs,
} from '@/lib/jobs/load';
import type { JobsLoad, LoadJob, RunSummary } from '@/lib/types/jobs';

/** Manage Jobs, Load: the day selector, the numbers, the charts' rows and the table's sorting (lib/jobs/load.ts). */

const job = (name: string, run_seconds: number, over: Partial<LoadJob> = {}): LoadJob => ({
  job: name, runs: 1, failed: 0, run_seconds, average_seconds: run_seconds, longest_seconds: run_seconds, ...over,
});

const run = (id: string, state: string | null, duration_s: number | null): RunSummary => ({
  id, state, run_type: 'scheduled', run_after: null, start: `2026-11-0${id}T00:00:00Z`, end: null, duration_s,
});

describe('the day selector', () => {
  it('takes 7, 30 or 90 from the address, and 7 for anything else', () => {
    expect(parseLoadDays({ days: '7' })).toBe(7);
    expect(parseLoadDays({ days: '30' })).toBe(30);
    expect(parseLoadDays({ days: ['90', '7'] })).toBe(90);
    expect(parseLoadDays({})).toBe(7);
    expect(parseLoadDays({ days: '' })).toBe(7);
    expect(parseLoadDays({ days: '14' })).toBe(7);
    expect(parseLoadDays({ days: 'week' })).toBe(7);
  });

  it('leaves the default window out of the address', () => {
    expect(loadHref()).toBe('/tasks/jobs/load');
    expect(loadHref(7)).toBe('/tasks/jobs/load');
    expect(loadHref(30)).toBe('/tasks/jobs/load?days=30');
    expect(loadHref(90)).toBe('/tasks/jobs/load?days=90');
  });
});

describe('what the view shows', () => {
  const answer = (runs: number, over: Partial<JobsLoad> = {}): JobsLoad => ({
    days: 7, start: '2026-11-06', end: '2026-11-12', partial: false, runs_read: runs,
    totals: { runs, failed: 0, run_seconds: 0, average_seconds: null, longest: null },
    daily: [], hourly: [], jobs: [], ...over,
  });

  it('says Airflow cannot be read, and whether it is configured', () => {
    expect(loadScreen({ available: false, base_url_configured: true })).toEqual({ kind: 'unavailable', configured: true });
    expect(loadScreen({ available: false, base_url_configured: false })).toEqual({ kind: 'unavailable', configured: false });
  });

  it('shows the empty state for a window with no runs, and the charts otherwise', () => {
    expect(loadScreen(answer(0))).toEqual({ kind: 'empty', partial: null, load: answer(0) });
    expect(loadScreen(answer(4))).toEqual({ kind: 'charts', partial: null, load: answer(4) });
  });

  it('notes the runs read when the window holds more', () => {
    const partial = answer(25000, { partial: true, runs_read: 20000 });
    expect(loadScreen(partial)).toEqual({ kind: 'charts', partial: 20000, load: partial });
  });

  it('draws a bar for any value above zero, and none for zero or nothing', () => {
    expect(barFloor(0.04)).toBe(2);
    expect(barFloor(12)).toBe(2);
    expect(barFloor(0)).toBe(0);
    expect(barFloor(null)).toBe(0);
    expect(barFloor(undefined)).toBe(0);
  });
});

describe('the numbers', () => {
  it('gives the failure rate to one decimal, and none with no runs', () => {
    expect(formatFailureRate(3, 412)).toBe('0.7%');
    expect(formatFailureRate(0, 10)).toBe('0.0%');
    expect(formatFailureRate(5, 5)).toBe('100.0%');
    expect(formatFailureRate(0, 0)).toBeNull();
  });

  it('picks seconds, minutes or hours by the longest value', () => {
    expect(durationUnit(0)).toBe('s');
    expect(durationUnit(119.9)).toBe('s');
    expect(durationUnit(120)).toBe('min');
    expect(durationUnit(7199)).toBe('min');
    expect(durationUnit(7200)).toBe('h');
  });

  it('converts seconds to a unit, to one decimal', () => {
    expect(inUnit(47.26, 's')).toBe(47.3);
    expect(inUnit(90, 'min')).toBe(1.5);
    expect(inUnit(5400, 'h')).toBe(1.5);
    expect(inUnit(100, 'h')).toBe(0);
  });
});

describe('the charts', () => {
  it('labels the days and puts their run time in one unit', () => {
    const { unit, rows } = dailyRows([
      { date: '2026-11-06', success: 5, failed: 1, other: 0, run_seconds: 2400 },
      { date: '2026-11-07', success: 0, failed: 0, other: 0, run_seconds: 0 },
    ]);
    expect(unit).toBe('min');
    expect(rows).toEqual([
      { date: '2026-11-06', label: '11-06', success: 5, failed: 1, other: 0, run_seconds: 2400, run_time: 40 },
      { date: '2026-11-07', label: '11-07', success: 0, failed: 0, other: 0, run_seconds: 0, run_time: 0 },
    ]);
  });

  it('draws days with no runs in seconds', () => {
    expect(dailyRows([]).unit).toBe('s');
    expect(dailyRows([]).rows).toEqual([]);
  });

  it('labels the hours with two digits', () => {
    const { unit, rows } = hourlyRows([
      { hour: 0, runs: 12, run_seconds: 9000 },
      { hour: 13, runs: 1, run_seconds: 30 },
    ]);
    expect(unit).toBe('h');
    expect(rows).toEqual([
      { hour: 0, label: '00', runs: 12, run_seconds: 9000, run_time: 2.5 },
      { hour: 13, label: '13', runs: 1, run_seconds: 30, run_time: 0 },
    ]);
  });

  it('keeps the jobs that took the most time, most first, without the ones that took none', () => {
    const jobs = [job('b', 30), job('idle', 0), job('a', 90), job('c', 60)];
    expect(topJobs(jobs, 2)).toEqual({
      unit: 's',
      rows: [{ ...job('a', 90), run_time: 90 }, { ...job('c', 60), run_time: 60 }],
    });
    expect(topJobs(jobs).rows.map((row) => row.job)).toEqual(['a', 'c', 'b']);
    // The list given is left as it was.
    expect(jobs.map((row) => row.job)).toEqual(['b', 'idle', 'a', 'c']);
  });

  it('keeps ten jobs unless told otherwise', () => {
    const many = Array.from({ length: 12 }, (_, i) => job(`j${i}`, i + 1));
    expect(topJobs(many).rows).toHaveLength(10);
  });

  it("draws a job's runs oldest first, a failed run apart, without the unfinished ones", () => {
    const { unit, rows } = runBars([
      run('4', 'running', null),
      run('3', 'failed', 600),
      run('2', 'success', 300),
      run('1', null, 150),
    ]);
    expect(unit).toBe('min');
    expect(rows).toEqual([
      { run: '1', start: '2026-11-01T00:00:00Z', state: null, duration_s: 150, ok: 2.5, failed: null },
      { run: '2', start: '2026-11-02T00:00:00Z', state: 'success', duration_s: 300, ok: 5, failed: null },
      { run: '3', start: '2026-11-03T00:00:00Z', state: 'failed', duration_s: 600, ok: null, failed: 10 },
    ]);
    expect(runBars([])).toEqual({ unit: 's', rows: [] });
  });
});

describe('the table of jobs', () => {
  const jobs = [
    job('beta', 300, { runs: 3, failed: 1, average_seconds: 100, longest_seconds: 200 }),
    job('alpha', 300, { runs: 9, failed: 0, average_seconds: null, longest_seconds: null }),
    job('gamma', 50, { runs: 1, failed: 2, average_seconds: 50, longest_seconds: 50 }),
  ];
  const names = (sorted: LoadJob[]) => sorted.map((row) => row.job);

  it('starts with the most run time first, equal jobs in the order given', () => {
    expect(DEFAULT_LOAD_SORT).toEqual({ key: 'run_seconds', direction: 'descending' });
    expect(names(sortLoadJobs(jobs, DEFAULT_LOAD_SORT, 'en'))).toEqual(['beta', 'alpha', 'gamma']);
    expect(names(jobs)).toEqual(['beta', 'alpha', 'gamma']);
  });

  it('sorts names A to Z and numbers either way', () => {
    expect(names(sortLoadJobs(jobs, { key: 'job', direction: 'ascending' }, 'en'))).toEqual(['alpha', 'beta', 'gamma']);
    expect(names(sortLoadJobs(jobs, { key: 'job', direction: 'descending' }, 'en'))).toEqual(['gamma', 'beta', 'alpha']);
    // Names sort as the language shown sorts them.
    const accented = [job('z', 1), job('ä', 1)];
    expect(names(sortLoadJobs(accented, { key: 'job', direction: 'ascending' }, 'de'))).toEqual(['ä', 'z']);
    expect(names(sortLoadJobs(accented, { key: 'job', direction: 'ascending' }, 'sv'))).toEqual(['z', 'ä']);
    expect(names(sortLoadJobs(jobs, { key: 'runs', direction: 'descending' }, 'en'))).toEqual(['alpha', 'beta', 'gamma']);
    expect(names(sortLoadJobs(jobs, { key: 'failed', direction: 'ascending' }, 'en'))).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('puts a missing average or longest last in both directions', () => {
    expect(names(sortLoadJobs(jobs, { key: 'average_seconds', direction: 'descending' }, 'en'))).toEqual(['beta', 'gamma', 'alpha']);
    expect(names(sortLoadJobs(jobs, { key: 'average_seconds', direction: 'ascending' }, 'en'))).toEqual(['gamma', 'beta', 'alpha']);
    const none = [job('x', 1, { longest_seconds: null }), job('y', 1, { longest_seconds: null }), job('z', 1)];
    expect(names(sortLoadJobs(none, { key: 'longest_seconds', direction: 'descending' }, 'en'))).toEqual(['z', 'x', 'y']);
  });

  it('turns a column around on a second click; a new column starts A to Z or largest first', () => {
    expect(nextLoadSort(DEFAULT_LOAD_SORT, 'run_seconds')).toEqual({ key: 'run_seconds', direction: 'ascending' });
    expect(nextLoadSort({ key: 'runs', direction: 'ascending' }, 'runs')).toEqual({ key: 'runs', direction: 'descending' });
    expect(nextLoadSort(DEFAULT_LOAD_SORT, 'job')).toEqual({ key: 'job', direction: 'ascending' });
    expect(nextLoadSort(DEFAULT_LOAD_SORT, 'failed')).toEqual({ key: 'failed', direction: 'descending' });
  });
});
