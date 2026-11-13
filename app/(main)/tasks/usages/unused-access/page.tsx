/**
 * View Usages, Unused Access: the people who hold one task and did not open it
 * in the window (GET /usage/unused-access). The task is picked on the page and
 * kept in the address.
 */

import { redirect } from 'next/navigation';
import { getUnusedAccess, getUsageByTask, load } from '@/lib/api/usage';
import { pageCount, parseDays, parsePage, parseTask, UNUSED_PAGE_SIZE, usageHref, type UsageParams } from '@/lib/usage/view';
import { LoadFailure, UsageFrame } from '../parts';
import { TaskPicker } from './TaskPicker';
import { UnusedAccessList } from './UnusedAccessList';

export const dynamic = 'force-dynamic';

export default async function UnusedAccessPage({ searchParams }: { searchParams: Promise<UsageParams> }) {
  const params = await searchParams;
  const days = parseDays(params);
  const page = parsePage(params);
  const task = parseTask(params);

  // With no task picked there is no list to read, but the page is still the
  // permission's: the by-task read sends a person without it to the no-access page.
  if (!task) {
    const gate = await load(() => getUsageByTask(days));
    return (
      <UsageFrame view="unused-access" days={days} range={gate.ok ? gate.data : undefined}>
        {gate.ok ? <TaskPicker task={null} days={days} /> : <LoadFailure message={gate.message} />}
      </UsageFrame>
    );
  }

  const unused = await load(() => getUnusedAccess(task, days, UNUSED_PAGE_SIZE, (page - 1) * UNUSED_PAGE_SIZE));
  // A page past the end is the last page.
  if (unused.ok && page > pageCount(unused.data.total, UNUSED_PAGE_SIZE)) {
    redirect(usageHref('unused-access', { task, days, page: pageCount(unused.data.total, UNUSED_PAGE_SIZE) }));
  }
  return (
    <UsageFrame view="unused-access" days={days} task={task} range={unused.ok ? unused.data : undefined}>
      <TaskPicker task={task} days={days} />
      {unused.ok ? <UnusedAccessList data={unused.data} page={page} /> : <LoadFailure message={unused.message} />}
    </UsageFrame>
  );
}
