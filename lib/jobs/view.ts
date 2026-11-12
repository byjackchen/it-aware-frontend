/**
 * Manage Jobs: what the screens decide, kept apart from how they draw it.
 */

import type { Job, JobParameter, JobsFailure, RunSummary, Step } from '@/lib/types/jobs';

/** Viewing needs `systems:jobs:read` (the backend checks it); control and recovery need this. */
export const JOBS_RUN_PERMISSION = 'systems:jobs:run';

// ── States ───────────────────────────────────────────────────────────────────

export type Tone = 'success' | 'failed' | 'running' | 'waiting' | 'none';

/** The colour family of an Airflow run or step state. */
export function stateTone(state: string | null): Tone {
  switch (state) {
    case 'success':
      return 'success';
    case 'failed':
    case 'upstream_failed':
      return 'failed';
    case 'running':
    case 'restarting':
      return 'running';
    case 'queued':
    case 'scheduled':
    case 'up_for_retry':
    case 'up_for_reschedule':
    case 'deferred':
      return 'waiting';
    default:
      return 'none';
  }
}

/** A run that has not ended: it can be stopped. */
export function isUnfinished(run: Pick<RunSummary, 'state'>): boolean {
  const tone = stateTone(run.state);
  return tone === 'running' || tone === 'waiting';
}

/** A run with a failed step (or itself failed): retrying its failed steps is offered. */
export function hasFailedSteps(run: Pick<RunSummary, 'state'>, steps: Step[]): boolean {
  return run.state === 'failed' || steps.some((s) => s.state === 'failed');
}

/** The tries a step's log can be read for: 1 … try_number (none for a step that never ran). */
export function logTries(step: Pick<Step, 'try_number'>): number[] {
  return Array.from({ length: Math.max(0, step.try_number) }, (_, i) => i + 1);
}

// ── Durations ────────────────────────────────────────────────────────────────

/** `47s`, `4m 7s`, `2h 5m`; null for none. */
export function formatDuration(seconds: number | null): string | null {
  if (seconds == null) return null;
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ── The job list's filter ────────────────────────────────────────────────────

export const JOB_FILTERS = ['all', 'active', 'paused', 'running', 'failed', 'load_errors'] as const;
export type JobFilter = (typeof JOB_FILTERS)[number];

function matchesState(job: Job, filter: JobFilter): boolean {
  switch (filter) {
    case 'active':
      return !job.paused;
    case 'paused':
      return job.paused;
    case 'running':
      return job.last_run !== null && isUnfinished(job.last_run);
    case 'failed':
      return job.last_run !== null && stateTone(job.last_run.state) === 'failed';
    case 'load_errors':
      return job.has_load_errors;
    default:
      return true;
  }
}

/** The jobs whose id, name, description or a tag holds the text, in the chosen state. */
export function filterJobs(jobs: Job[], text: string, filter: JobFilter): Job[] {
  const needle = text.trim().toLowerCase();
  return jobs.filter((job) => {
    if (!matchesState(job, filter)) return false;
    if (!needle) return true;
    return [job.id, job.name, job.description ?? '', ...job.tags].some((v) => v.toLowerCase().includes(needle));
  });
}

// ── The run-now form ─────────────────────────────────────────────────────────

export type FieldKind = 'integer' | 'number' | 'boolean' | 'string' | 'json';

export interface ParameterField {
  name: string;
  kind: FieldKind;
  description: string | null;
  /** The form's starting value: text, or a checkbox's state. */
  initial: string | boolean;
}

function schemaType(schema: Record<string, unknown>): string | null {
  const type = schema.type;
  if (typeof type === 'string') return type;
  if (Array.isArray(type)) return (type.find((t) => t !== 'null') as string | undefined) ?? null;
  return null;
}

function kindOf(parameter: JobParameter): FieldKind {
  const type = schemaType(parameter.schema);
  if (type === 'integer' || type === 'number' || type === 'boolean' || type === 'string') return type;
  if (type === null && typeof parameter.default === 'string') return 'string';
  return 'json';
}

/** One form field per parameter the job defines, filled with its default. */
export function parameterFields(parameters: JobParameter[]): ParameterField[] {
  return parameters.map((p) => {
    const kind = kindOf(p);
    let initial: string | boolean;
    if (kind === 'boolean') initial = p.default === true;
    else if (p.default == null) initial = '';
    else if (kind === 'json') initial = JSON.stringify(p.default);
    else initial = String(p.default);
    return { name: p.name, kind, description: p.description, initial };
  });
}

export type ParsedParameters = { ok: true; values: Record<string, unknown> } | { ok: false; invalid: string[] };

/**
 * The parameters to send, from the form's values. An empty number or JSON
 * field, or an empty string field with no default, is left out (the job's
 * default applies); a value that does not read as its kind is reported by name.
 */
export function parameterValues(
  fields: ParameterField[],
  form: Record<string, string | boolean | undefined>,
): ParsedParameters {
  const values: Record<string, unknown> = {};
  const invalid: string[] = [];
  for (const field of fields) {
    const raw = form[field.name] ?? field.initial;
    if (field.kind === 'boolean') {
      values[field.name] = raw === true;
      continue;
    }
    const text = String(raw);
    // An empty string with no default is left out, as an empty number or JSON
    // field is; an empty string that replaces a default is sent.
    if (field.kind === 'string') {
      if (text !== '' || field.initial !== '') values[field.name] = text;
      continue;
    }
    if (text.trim() === '') continue;
    if (field.kind === 'json') {
      try {
        values[field.name] = JSON.parse(text);
      } catch {
        invalid.push(field.name);
      }
      continue;
    }
    const n = Number(text);
    if (!Number.isFinite(n) || (field.kind === 'integer' && !Number.isInteger(n))) invalid.push(field.name);
    else values[field.name] = n;
  }
  return invalid.length ? { ok: false, invalid } : { ok: true, values };
}

// ── Errors ───────────────────────────────────────────────────────────────────

/**
 * Airflow refused IT-Aware's service account this action (503 `airflow_refused`):
 * the action is unavailable here, not merely failed.
 */
export function isUnavailable(failure: Pick<JobsFailure, 'code'>): boolean {
  return failure.code === 'airflow_refused';
}

// ── Logs ─────────────────────────────────────────────────────────────────────

/** A log read so far, with what the next part adds. */
export function appendLog(
  sofar: { content: string; truncated: boolean },
  next: { content: string; truncated: boolean; next_token: string | null },
) {
  return {
    content: sofar.content + next.content,
    truncated: sofar.truncated || next.truncated,
    next_token: next.next_token,
  };
}
