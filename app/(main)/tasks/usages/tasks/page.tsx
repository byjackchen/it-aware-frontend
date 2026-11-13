/**
 * View Usages, By Task: every task of the catalog with its opens, the people
 * who opened it and its holders (GET /usage/tasks).
 */

import { getUsageByTask, load } from '@/lib/api/usage';
import { parseDays, type UsageParams } from '@/lib/usage/view';
import { LoadFailure, UsageFrame } from '../parts';
import { UsageByTaskTable } from './UsageByTaskTable';

export const dynamic = 'force-dynamic';

export default async function UsageByTaskPage({ searchParams }: { searchParams: Promise<UsageParams> }) {
  const days = parseDays(await searchParams);
  const usage = await load(() => getUsageByTask(days));
  return (
    <UsageFrame view="tasks" days={days} range={usage.ok ? usage.data : undefined}>
      {usage.ok ? <UsageByTaskTable data={usage.data} days={days} /> : <LoadFailure message={usage.message} />}
    </UsageFrame>
  );
}
