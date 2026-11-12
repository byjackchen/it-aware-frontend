'use server';

/**
 * Server Actions for Manage Jobs: control and recovery (each recorded by the
 * backend), and reading a step's log on. Each answers plain data: the record
 * row the backend wrote, or the failure (its code and message) to show.
 */

import { revalidatePath } from 'next/cache';
import * as api from '@/lib/api/jobs';
import { JOBS_BASE } from '@/lib/jobs/paths';
import { logger } from '@/lib/logger';
import type { JobActionRecord, JobsFailure, StepLog } from '@/lib/types/jobs';

export type JobsResult<T> = { ok: true; data: T } | { ok: false; failure: JobsFailure };

async function control(
  action: string,
  work: () => Promise<JobActionRecord>,
): Promise<JobsResult<JobActionRecord>> {
  const requestId = logger.generateRequestId();
  const result = await api.attempt(work);
  if (result.ok) {
    logger.info(`Recorded as ${result.data.outcome}`, { requestId, action });
    revalidatePath(JOBS_BASE);
  } else {
    logger.error('Failed', result.failure.message, { requestId, action, code: result.failure.code });
  }
  return result;
}

export async function pauseJob(jobId: string) {
  return control('Jobs:pause', () => api.pauseJob(jobId));
}

export async function resumeJob(jobId: string) {
  return control('Jobs:resume', () => api.resumeJob(jobId));
}

export async function runJob(jobId: string, parameters: Record<string, unknown>) {
  return control('Jobs:run', () => api.runJob(jobId, parameters));
}

export async function retryFailed(jobId: string, runId: string) {
  return control('Jobs:retryFailed', () => api.retryFailed(jobId, runId));
}

export async function stopRun(jobId: string, runId: string) {
  return control('Jobs:stop', () => api.stopRun(jobId, runId));
}

/** The next part of a step's log, from the `next_token` of the part before. */
export async function readStepLog(
  jobId: string,
  runId: string,
  stepId: string,
  tryNumber: number,
  mapIndex: number,
  token: string,
): Promise<JobsResult<StepLog>> {
  return api.attempt(() => api.getStepLog(jobId, runId, stepId, { tryNumber, mapIndex, token }));
}
