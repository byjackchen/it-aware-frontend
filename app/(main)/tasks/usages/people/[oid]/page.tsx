/**
 * View Usages, By Person, one person: their sign-ins and the tasks they opened
 * in the window (GET /usage/people/{oid}). A sub-page of By Person, at
 * /tasks/usages/people/<oid>. A task the viewer holds links to it.
 */

import { getTranslations } from 'next-intl/server';
import { getTasksMine } from '@/lib/api/tasks';
import { getPersonUsage, load } from '@/lib/api/usage';
import { parseDays, type UsageParams } from '@/lib/usage/view';
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
  const t = await getTranslations('Usage');
  const [person, mine] = await Promise.all([load(() => getPersonUsage(oid, days)), getTasksMine().catch(() => null)]);
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
