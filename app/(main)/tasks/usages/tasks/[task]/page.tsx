/**
 * View Usages, By Task, one task: the people who opened it in the window, the
 * most opens first (GET /usage/tasks/{task}/people). A sub-page of By Task, at
 * /tasks/usages/tasks/<task>, reached from the People number of its row.
 */

import { notFound, redirect } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { getTaskPeople, getUsagePeople, load } from '@/lib/api/usage';
import { isSegment, pageCount, parseDays, parsePage, PEOPLE_PAGE_SIZE, taskName, usageHref, type UsageParams } from '@/lib/usage/view';
import { LoadFailure, UsageFrame } from '../../parts';
import { TaskPeopleList } from './TaskPeopleList';

export const dynamic = 'force-dynamic';

interface TaskPeoplePageProps {
  params: Promise<{ task: string }>;
  searchParams: Promise<UsageParams>;
}

export default async function TaskPeoplePage({ params, searchParams }: TaskPeoplePageProps) {
  const [{ task }, query] = await Promise.all([params, searchParams]);
  const days = parseDays(query);
  const page = parsePage(query);
  // A segment that cannot be a task code names nothing, and is never sent on; a
  // person without the permission still gets the no-access page first.
  if (!isSegment(task)) {
    await load(() => getUsagePeople(days, 1, 0));
    notFound();
  }
  const t = await getTranslations('Usage.taskPeople');
  const name = taskName(task, await getLocale());

  // The backend answers a person without the permission before it looks for the task.
  const people = await load(() => getTaskPeople(task, days, PEOPLE_PAGE_SIZE, (page - 1) * PEOPLE_PAGE_SIZE));
  // A page past the end is the last page.
  if (people.ok && page > pageCount(people.data.total, PEOPLE_PAGE_SIZE)) {
    redirect(usageHref('tasks', { sub: task, days, page: pageCount(people.data.total, PEOPLE_PAGE_SIZE) }));
  }
  return (
    <UsageFrame
      view="tasks"
      days={days}
      sub={{ segment: task, title: t('title', { task: name }) }}
      range={people.ok ? people.data : undefined}
    >
      {people.ok ? <TaskPeopleList data={people.data} page={page} /> : <LoadFailure message={people.message} />}
    </UsageFrame>
  );
}
