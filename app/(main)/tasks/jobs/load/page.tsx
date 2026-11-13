/**
 * Manage Jobs, Load: how much the jobs ran and how long they took, by UTC day,
 * by hour of the day and by job (GET /jobs/load). The window (7, 30 or 90 days)
 * is in the address.
 */

import { getJobsLoad, read } from '@/lib/api/jobs';
import { parseLoadDays } from '@/lib/jobs/load';
import { LoadFailure } from '../parts';
import { LoadFrame, LoadView } from './LoadView';

// Asked of the backend on every load (and on router.refresh()); the backend
// keeps its answer for 5 minutes, so the numbers are at most that old.
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function JobsLoadPage({ searchParams }: PageProps) {
  const days = parseLoadDays(await searchParams);
  // A person without `systems:jobs:read` goes to the no-access page (read).
  const load = await read(() => getJobsLoad(days));
  return (
    <LoadFrame days={days} range={load.ok && load.data.available !== false ? load.data : undefined}>
      {load.ok ? <LoadView answer={load.data} /> : <LoadFailure failure={load.failure} />}
    </LoadFrame>
  );
}
