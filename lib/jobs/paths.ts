/**
 * Where Manage Jobs lives, and how its one page picks a screen.
 *
 * Every screen is the one page at JOBS_BASE, chosen by search parameters:
 *   (none)                         the job list
 *   ?tab=actions[&job=][&page=]    the action record (optionally one job's)
 *   ?job=<id>[&page=]              a job and its runs
 *   ?job=<id>&run=<id>[&step=<id>&try=<n>&map=<i>]   a run, its steps, one step's log
 * Moving the page means changing JOBS_BASE only.
 */

export const JOBS_BASE = '/tasks/jobs';

/** Runs per page of a job, and record rows per page. */
export const RUNS_PAGE_SIZE = 25;
export const ACTIONS_PAGE_SIZE = 50;

/**
 * A job, run or step id as the backend accepts it (app/jobs/service.py
 * ID_PATTERN): Unicode letters and digits (Python's `\w`) and `_ - . : + @`, at
 * least one not a dot, at most 250 characters (code points, as Python counts).
 * So `.` and `..` never reach a path, and `~`, Airflow's "all" wildcard, is
 * refused.
 */
const ID = /^[\p{L}\p{N}_.:+@-]*[\p{L}\p{N}_:+@-][\p{L}\p{N}_.:+@-]*$/u;
const ID_MAX = 250;
export const INVALID_ID_MESSAGE = 'Not a job, run or step id.';

export function isJobsId(value: string): boolean {
  return [...value].length <= ID_MAX && ID.test(value);
}

export interface JobsLink {
  tab?: 'actions';
  job?: string;
  run?: string;
  step?: string;
  try?: number;
  map?: number;
  page?: number;
}

/** The address of a screen; ids are encoded by URLSearchParams. */
export function jobsHref(link: JobsLink = {}): string {
  const query = new URLSearchParams();
  if (link.tab) query.set('tab', link.tab);
  if (link.job) query.set('job', link.job);
  if (link.run) query.set('run', link.run);
  if (link.step) query.set('step', link.step);
  if (link.try !== undefined) query.set('try', String(link.try));
  if (link.map !== undefined && link.map !== -1) query.set('map', String(link.map));
  if (link.page && link.page > 1) query.set('page', String(link.page));
  const text = query.toString();
  return text ? `${JOBS_BASE}?${text}` : JOBS_BASE;
}

export type JobsView =
  | { kind: 'list' }
  | { kind: 'actions'; job: string | null; page: number }
  | { kind: 'job'; job: string; page: number }
  | { kind: 'run'; job: string; run: string; step: { id: string; try: number; map: number } | null }
  | { kind: 'invalid'; id: string };

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, name: string): string | null {
  const value = params[name];
  const first = Array.isArray(value) ? value[0] : value;
  return first ? first : null;
}

function integer(text: string | null, fallback: number, min: number): number {
  const n = text === null ? NaN : Number(text);
  return Number.isInteger(n) && n >= min ? n : fallback;
}

/** The screen the page's search parameters ask for. */
export function parseJobsView(params: Params): JobsView {
  const invalid = ['job', 'run', 'step'].map((name) => one(params, name)).find((id) => id !== null && !isJobsId(id));
  if (invalid !== undefined) return { kind: 'invalid', id: invalid as string };
  const job = one(params, 'job');
  const page = integer(one(params, 'page'), 1, 1);
  if (one(params, 'tab') === 'actions') return { kind: 'actions', job, page };
  if (!job) return { kind: 'list' };
  const run = one(params, 'run');
  if (!run) return { kind: 'job', job, page };
  const step = one(params, 'step');
  return {
    kind: 'run',
    job,
    run,
    step: step
      ? { id: step, try: integer(one(params, 'try'), 1, 0), map: integer(one(params, 'map'), -1, -1) }
      : null,
  };
}
