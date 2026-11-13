/**
 * View Usages, Unused Access: the people who hold one task and did not open it
 * in the window (GET /usage/unused-access). The task is picked on the page and
 * kept in the address.
 */

import { getUnusedAccess, load } from '@/lib/api/usage';
import { parseDays, parsePage, parseTask, UNUSED_PAGE_SIZE, type UsageParams } from '@/lib/usage/view';
import { LoadFailure, UsageFrame } from '../parts';
import { TaskPicker } from './TaskPicker';
import { UnusedAccessList } from './UnusedAccessList';

export const dynamic = 'force-dynamic';

export default async function UnusedAccessPage({ searchParams }: { searchParams: Promise<UsageParams> }) {
  const params = await searchParams;
  const days = parseDays(params);
  const page = parsePage(params);
  const task = parseTask(params);
  const unused = task ? await load(() => getUnusedAccess(task, days, UNUSED_PAGE_SIZE, (page - 1) * UNUSED_PAGE_SIZE)) : null;
  return (
    <UsageFrame view="unused-access" days={days} task={task} window={unused?.ok ? unused.data : undefined}>
      <TaskPicker task={task} days={days} />
      {unused && (unused.ok ? <UnusedAccessList data={unused.data} page={page} /> : <LoadFailure message={unused.message} />)}
    </UsageFrame>
  );
}
