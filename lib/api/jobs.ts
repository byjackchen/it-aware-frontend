/**
 * Server-side client for Manage Jobs (backend `/jobs`, specs/api_specs_jobs.md).
 *
 * The backend answers an Airflow failure with `{"detail": {"code", "message"}}`;
 * JobsApiError keeps that code so the page can tell an action Airflow refuses
 * (`airflow_refused`) from one that failed.
 */

import { cookies } from 'next/headers';
import { redirect, unstable_rethrow } from 'next/navigation';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { ApiError } from '@/lib/api/errors';
import { INVALID_ID_MESSAGE, isJobsId } from '@/lib/jobs/paths';
import type {
  ActionsResponse,
  JobActionRecord,
  JobDetail,
  JobsFailure,
  JobsLoad,
  JobsResponse,
  RunDetail,
  RunsResponse,
  StepLog,
} from '@/lib/types/jobs';

const BASE = `${RUNTIME_CONFIG.backend.domain}/jobs`;

export class JobsApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    public readonly code: string | null,
  ) {
    super(message, status);
    this.name = 'JobsApiError';
  }
}

/** The code and message of an error answer, whatever shape its `detail` has. */
export function readFailure(body: unknown, status: number): { code: string | null; message: string } {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === 'string') return { code: null, message: detail };
  if (detail && typeof detail === 'object') {
    const { code, message } = detail as { code?: unknown; message?: unknown };
    return {
      code: typeof code === 'string' ? code : null,
      message: typeof message === 'string' ? message : `API Error: ${status}`,
    };
  }
  return { code: null, message: `API Error: ${status}` };
}

/**
 * A caught error as the page shows it. Next.js's own signals (the redirect to
 * the login page on a 401) are thrown on, never shown.
 */
export function toFailure(error: unknown): JobsFailure {
  unstable_rethrow(error);
  if (error instanceof JobsApiError) return { status: error.status, code: error.code, message: error.message };
  return { status: 0, code: null, message: error instanceof Error ? error.message : String(error) };
}

/** Run a read or an action; answer its data, or the failure to show. */
export async function attempt<T>(work: () => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; failure: JobsFailure }> {
  try {
    return { ok: true, data: await work() };
  } catch (error) {
    return { ok: false, failure: toFailure(error) };
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieHeader = (await cookies())
    .getAll()
    .filter((c) => c.name.startsWith('it_aware_'))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  if (!res.ok) {
    const { code, message } = readFailure(await res.json().catch(() => null), res.status);
    throw new JobsApiError(message, res.status, code);
  }
  return res.json();
}

/** An id for a path: refused before any fetch when the backend would refuse it (422 invalid_id). */
function id(value: string): string {
  if (!isJobsId(value)) throw new JobsApiError(INVALID_ID_MESSAGE, 422, 'invalid_id');
  return encodeURIComponent(value);
}

/** A query string; every caller sends at least one value. */
function query(values: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) q.set(key, String(value));
  }
  return `?${q}`;
}

// ── View ─────────────────────────────────────────────────────────────────────

export async function listJobs(): Promise<JobsResponse> {
  return call('');
}

export async function getJob(jobId: string): Promise<JobDetail> {
  return call(`/${id(jobId)}`);
}

export async function listRuns(jobId: string, limit: number, offset: number): Promise<RunsResponse> {
  return call(`/${id(jobId)}/runs${query({ limit, offset })}`);
}

export async function getRun(jobId: string, runId: string): Promise<RunDetail> {
  return call(`/${id(jobId)}/runs/${id(runId)}`);
}

export async function getStepLog(
  jobId: string,
  runId: string,
  stepId: string,
  options: { tryNumber: number; mapIndex: number; token?: string | null },
): Promise<StepLog> {
  const q = query({ try: options.tryNumber, map_index: options.mapIndex, token: options.token });
  return call(`/${id(jobId)}/runs/${id(runId)}/steps/${id(stepId)}/log${q}`);
}

export async function listActions(jobId: string | null, limit: number, offset: number): Promise<ActionsResponse> {
  return call(`/actions${query({ job_id: jobId, limit, offset })}`);
}

/** The load of the last `days` UTC days: runs and run time by day, by hour and by job. */
export async function getJobsLoad(days: number): Promise<JobsLoad> {
  return call(`/load${query({ days })}`);
}

// ── Control and recovery (each recorded by the backend) ──────────────────────

export async function pauseJob(jobId: string): Promise<JobActionRecord> {
  return call(`/${id(jobId)}/pause`, { method: 'POST' });
}

export async function resumeJob(jobId: string): Promise<JobActionRecord> {
  return call(`/${id(jobId)}/resume`, { method: 'POST' });
}

export async function runJob(jobId: string, parameters: Record<string, unknown>): Promise<JobActionRecord> {
  return call(`/${id(jobId)}/runs`, { method: 'POST', body: JSON.stringify({ parameters }) });
}

export async function retryFailed(jobId: string, runId: string): Promise<JobActionRecord> {
  return call(`/${id(jobId)}/runs/${id(runId)}/retry-failed`, { method: 'POST' });
}

export async function stopRun(jobId: string, runId: string): Promise<JobActionRecord> {
  return call(`/${id(jobId)}/runs/${id(runId)}/stop`, { method: 'POST' });
}
