/**
 * View Usages, Overview: how many people use IT-Aware, their sign-ins and the
 * tasks they opened, in total and day by day (GET /usage/overview).
 */

import { getUsageOverview, load } from '@/lib/api/usage';
import { parseDays, type UsageParams } from '@/lib/usage/view';
import { LoadFailure, UsageFrame } from '../parts';
import { UsageOverviewView } from './UsageOverviewView';

// Usage is read fresh on every load.
export const dynamic = 'force-dynamic';

export default async function UsageOverviewPage({ searchParams }: { searchParams: Promise<UsageParams> }) {
  const days = parseDays(await searchParams);
  const overview = await load(() => getUsageOverview(days));
  return (
    <UsageFrame view="overview" days={days} window={overview.ok ? overview.data : undefined}>
      {overview.ok ? <UsageOverviewView data={overview.data} /> : <LoadFailure message={overview.message} />}
    </UsageFrame>
  );
}
