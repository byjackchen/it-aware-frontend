/**
 * Manage Jobs: IT-Aware's Airflow jobs — view, control, recover, and the record
 * of who did what. One page; the screen is chosen by search parameters
 * (lib/jobs/paths.ts). The backend calls Airflow; the browser never does.
 */

import {
  attempt,
  getJob,
  getRun,
  getStepLog,
  listActions,
  listJobs,
  listRuns,
} from '@/lib/api/jobs';
import { ACTIONS_PAGE_SIZE, parseJobsView, RUNS_PAGE_SIZE } from '@/lib/jobs/paths';
import { ActionRecord } from './ActionRecord';
import { JobsList } from './JobsList';
import { JobView } from './JobView';
import { JobsFrame, LoadFailure } from './parts';
import { RunView } from './RunView';

// Always read Airflow fresh on load (and on router.refresh()).
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ManageJobsPage({ searchParams }: PageProps) {
  const view = parseJobsView(await searchParams);

  if (view.kind === 'actions') {
    const record = await attempt(() => listActions(view.job, ACTIONS_PAGE_SIZE, (view.page - 1) * ACTIONS_PAGE_SIZE));
    return (
      <JobsFrame tab="actions">
        {record.ok ? <ActionRecord data={record.data} job={view.job} page={view.page} /> : <LoadFailure failure={record.failure} />}
      </JobsFrame>
    );
  }

  if (view.kind === 'list') {
    const jobs = await attempt(listJobs);
    return (
      <JobsFrame tab="jobs">
        {jobs.ok ? <JobsList data={jobs.data} /> : <LoadFailure failure={jobs.failure} />}
      </JobsFrame>
    );
  }

  if (view.kind === 'job') {
    const [job, runs] = await Promise.all([
      attempt(() => getJob(view.job)),
      attempt(() => listRuns(view.job, RUNS_PAGE_SIZE, (view.page - 1) * RUNS_PAGE_SIZE)),
    ]);
    return (
      <JobsFrame tab="jobs">
        {!job.ok ? (
          <LoadFailure failure={job.failure} />
        ) : !runs.ok ? (
          <LoadFailure failure={runs.failure} />
        ) : (
          <JobView job={job.data} runs={runs.data} page={view.page} />
        )}
      </JobsFrame>
    );
  }

  const { step } = view;
  const [job, run, log] = await Promise.all([
    attempt(() => getJob(view.job)),
    attempt(() => getRun(view.job, view.run)),
    step ? attempt(() => getStepLog(view.job, view.run, step.id, { tryNumber: step.try, mapIndex: step.map })) : null,
  ]);
  return (
    <JobsFrame tab="jobs">
      {!job.ok ? (
        <LoadFailure failure={job.failure} />
      ) : !run.ok ? (
        <LoadFailure failure={run.failure} />
      ) : (
        <RunView job={job.data} run={run.data} step={step && log ? { ...step, log } : null} />
      )}
    </JobsFrame>
  );
}
