/**
 * View Usages, By Person: everyone with a sign-in or an opened task in the
 * window, the most task opens first (GET /usage/people). Each person links to
 * their own usage, /tasks/usages/people/<oid>.
 */

import { redirect } from 'next/navigation';
import { getUsagePeople, load } from '@/lib/api/usage';
import { pageCount, parseDays, parsePage, PEOPLE_PAGE_SIZE, usageHref, type UsageParams } from '@/lib/usage/view';
import { LoadFailure, UsageFrame } from '../parts';
import { PeopleList } from './PeopleList';

export const dynamic = 'force-dynamic';

export default async function UsageByPersonPage({ searchParams }: { searchParams: Promise<UsageParams> }) {
  const params = await searchParams;
  const days = parseDays(params);
  const page = parsePage(params);
  const people = await load(() => getUsagePeople(days, PEOPLE_PAGE_SIZE, (page - 1) * PEOPLE_PAGE_SIZE));
  // A page past the end is the last page.
  if (people.ok && page > pageCount(people.data.total, PEOPLE_PAGE_SIZE)) {
    redirect(usageHref('people', { days, page: pageCount(people.data.total, PEOPLE_PAGE_SIZE) }));
  }
  return (
    <UsageFrame view="people" days={days} range={people.ok ? people.data : undefined}>
      {people.ok ? <PeopleList data={people.data} page={page} /> : <LoadFailure message={people.message} />}
    </UsageFrame>
  );
}
