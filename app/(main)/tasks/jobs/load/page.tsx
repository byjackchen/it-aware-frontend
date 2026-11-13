/**
 * Manage Jobs, Load: how much the jobs ran and how long they took, by UTC day,
 * by hour of the day and by job (GET /jobs/load). The window (7, 30 or 90 days)
 * is in the address.
 */

import { redirect } from 'next/navigation';
import { attempt, getJobsLoad } from '@/lib/api/jobs';
import { parseLoadDays } from '@/lib/jobs/load';
import { LoadFailure } from '../parts';
import { LoadFrame, LoadView } from './LoadView';

// Always read Airflow fresh on load (and on router.refresh()).
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function JobsLoadPage({ searchParams }: PageProps) {
  const days = parseLoadDays(await searchParams);
  const load = await attempt(() => getJobsLoad(days));
  // A person without `systems:jobs:read` has no access to the view.
  if (!load.ok && load.failure.status === 403) redirect('/access-denied');
  return (
    <LoadFrame days={days} range={load.ok && !('available' in load.data) ? load.data : undefined}>
      {load.ok ? <LoadView data={load.data} /> : <LoadFailure failure={load.failure} />}
    </LoadFrame>
  );
}
