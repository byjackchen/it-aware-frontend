/**
 * Manage Jobs: the backend's `/jobs` API (it-aware-backend specs/api_specs_jobs.md).
 * IT-Aware's Airflow jobs, their runs and steps, and the record of who did what.
 */

export interface RunSummary {
  id: string;
  state: string | null;
  run_type: string | null;
  run_after: string | null;
  start: string | null;
  end: string | null;
  duration_s: number | null;
}

export interface Job {
  id: string;
  name: string;
  description: string | null;
  schedule: string | null;
  next_run: string | null;
  paused: boolean;
  has_load_errors: boolean;
  tags: string[];
  last_run: RunSummary | null;
  manual_run_allowed: boolean;
  manual_run_refusal: string | null;
  retry_failed_allowed: boolean;
  retry_failed_refusal: string | null;
}

/** Fail-soft: `available: false` with no jobs when Airflow can't be read. */
export interface JobsResponse {
  available: boolean;
  base_url_configured: boolean;
  jobs: Job[];
}

/** A parameter a hand-started run may set, from the job's definition. */
export interface JobParameter {
  name: string;
  default: unknown;
  description: string | null;
  schema: Record<string, unknown>;
}

export interface JobDetail extends Job {
  parameters: JobParameter[];
}

export interface RunsResponse {
  runs: RunSummary[];
  total: number;
}

export interface Step {
  id: string;
  name: string;
  map_index: number;
  state: string | null;
  start: string | null;
  end: string | null;
  duration_s: number | null;
  try_number: number;
}

export interface RunDetail extends RunSummary {
  job_id: string;
  parameters: Record<string, unknown>;
  steps: Step[];
}

export interface StepLog {
  job_id: string;
  run_id: string;
  step_id: string;
  try_number: number;
  content: string;
  /** Only the end of the log was returned. */
  truncated: boolean;
  /** Pass back as `token` to read on. */
  next_token: string | null;
}

export type JobAction = 'pause' | 'resume' | 'run' | 'retry_failed' | 'stop';
export type ActionOutcome = 'pending' | 'succeeded' | 'failed' | 'refused';

export interface JobActionRecord {
  id: string;
  account_oid: string;
  username: string;
  action: JobAction;
  job_id: string;
  run_id: string | null;
  parameters: Record<string, unknown> | null;
  requested_at: string;
  outcome: ActionOutcome;
  error: string | null;
}

export interface ActionsResponse {
  actions: JobActionRecord[];
  total: number;
}

/** A failed call as the page sees it: the backend's code (when it gave one) and message. */
export interface JobsFailure {
  status: number;
  code: string | null;
  message: string;
}
