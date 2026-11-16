/**
 * Manage Jobs: IT-Aware's Airflow jobs — view, control, recover, and the record
 * of who did what: the task's Jobs view (its Load view is ../load). One page;
 * the screen is chosen by search parameters (lib/jobs/paths.ts). The backend
 * calls Airflow; the browser never does. A person without the permission (403)
 * goes to the no-access page.
 */

import {
  getJob,
  getRun,
  getStepLog,
  listActions,
  listJobs,
  listRuns,
  read,
} from '@/lib/api/jobs';
import { ACTIONS_PAGE_SIZE, CHART_RUNS, INVALID_ID_MESSAGE, parseJobsView, RUNS_PAGE_SIZE } from '@/lib/jobs/paths';
import { ActionRecord } from '../ActionRecord';
import { JobsList } from '../JobsList';
import { JobView } from '../JobView';
import { JobsFrame, LoadFailure } from '../parts';
import { RunView } from '../RunView';

// Always read Airflow fresh on load (and on router.refresh()).
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ManageJobsPage({ searchParams }: PageProps) {
  const view = parseJobsView(await searchParams);

  // An id the backend would refuse (`.`, `..`, characters outside its set) is never asked for.
  if (view.kind === 'invalid') {
    return (
      <JobsFrame tab="jobs">
        <LoadFailure failure={{ status: 422, code: 'invalid_id', message: INVALID_ID_MESSAGE }} />
      </JobsFrame>
    );
  }

  if (view.kind === 'actions') {
    const record = await read(() => listActions(view.job, ACTIONS_PAGE_SIZE, (view.page - 1) * ACTIONS_PAGE_SIZE));
    return (
      <JobsFrame tab="actions">
        {record.ok ? <ActionRecord data={record.data} job={view.job} page={view.page} /> : <LoadFailure failure={record.failure} />}
      </JobsFrame>
    );
  }

  if (view.kind === 'list') {
    const jobs = await read(listJobs);
    return (
      <JobsFrame tab="jobs">
        {jobs.ok ? <JobsList data={jobs.data} /> : <LoadFailure failure={jobs.failure} />}
      </JobsFrame>
    );
  }

  if (view.kind === 'job') {
    // The chart draws the newest runs whatever page of them is listed. The first
    // page is the start of those, so it is one read, and the table fails with it;
    // a later page is its own read, and shows when the chart's read fails.
    const [job, newest, later] = await Promise.all([
      read(() => getJob(view.job)),
      read(() => listRuns(view.job, CHART_RUNS, 0)),
      view.page > 1 ? read(() => listRuns(view.job, RUNS_PAGE_SIZE, (view.page - 1) * RUNS_PAGE_SIZE)) : null,
    ]);
    const runs = later ?? (newest.ok ? { ...newest, data: { ...newest.data, runs: newest.data.runs.slice(0, RUNS_PAGE_SIZE) } } : newest);
    return (
      <JobsFrame tab="jobs">
        {!job.ok ? (
          <LoadFailure failure={job.failure} />
        ) : !runs.ok ? (
          <LoadFailure failure={runs.failure} />
        ) : (
          <JobView job={job.data} runs={runs.data} newest={newest.ok ? newest.data.runs : []} page={view.page} />
        )}
      </JobsFrame>
    );
  }

  const { step } = view;
  const [job, run, log] = await Promise.all([
    read(() => getJob(view.job)),
    read(() => getRun(view.job, view.run)),
    step ? read(() => getStepLog(view.job, view.run, step.id, { tryNumber: step.try, mapIndex: step.map })) : null,
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
