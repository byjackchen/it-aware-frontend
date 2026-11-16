/**
 * View Usages, By Person, one person: their sign-ins and the tasks they opened
 * in the window (GET /usage/people/{oid}). A sub-page of By Person, at
 * /tasks/usages/people/<oid>. A task the viewer holds links to it.
 */

import { notFound, unstable_rethrow } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getTasksMine } from '@/lib/api/tasks';
import { getPersonUsage, getUsagePeople, load } from '@/lib/api/usage';
import { isSegment, parseDays, type UsageParams } from '@/lib/usage/view';
import { LoadFailure, UsageFrame } from '../../parts';
import { PersonDetail } from './PersonDetail';

export const dynamic = 'force-dynamic';

interface PersonPageProps {
  params: Promise<{ oid: string }>;
  searchParams: Promise<UsageParams>;
}

export default async function PersonUsagePage({ params, searchParams }: PersonPageProps) {
  const [{ oid }, query] = await Promise.all([params, searchParams]);
  const days = parseDays(query);
  // A segment that cannot be an oid names nobody, and is never sent on; a person
  // without the permission still gets the no-access page first.
  if (!isSegment(oid)) {
    await load(() => getUsagePeople(days, 1, 0));
    notFound();
  }
  const t = await getTranslations('Usage');
  const [person, mine] = await Promise.all([
    load(() => getPersonUsage(oid, days)),
    // Without the viewer's tasks nothing is linked; a sign-in that ran out still goes to the login page.
    getTasksMine().catch((error: unknown) => {
      unstable_rethrow(error);
      return null;
    }),
  ]);
  const title = person.ok ? (person.data.username ?? t('deletedAccount')) : t('person.unknown');
  return (
    <UsageFrame view="people" days={days} sub={{ segment: oid, title }} range={person.ok ? person.data : undefined}>
      {person.ok ? (
        <PersonDetail data={person.data} held={mine ? mine.tasks.map((own) => own.task) : null} />
      ) : (
        <LoadFailure message={person.message} />
      )}
    </UsageFrame>
  );
}
