/**
 * View Raw Records, one view per raw source (GET /raw/{source}/records): each
 * key at its newest record, newest first, as the source's reader names it.
 * The chat text (tier 4) has no view.
 */

import { notFound } from 'next/navigation';
import { getRawRecords } from '@/lib/api/data-tasks';
import { load } from '@/lib/api/usage';
import { param, RAW_PAGE_SIZE, rawSourceOf } from '@/lib/data-tasks/view';
import { RawRecordsView } from './RawRecordsView';

export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;

export default async function RawRecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ view: string }>;
  searchParams: Promise<Params>;
}) {
  const { view } = await params;
  const source = rawSourceOf(view);
  if (!source) notFound();
  const query = await searchParams;
  const cursor = param(query.cursor);
  const key = param(query.key);
  const read = await load(() => getRawRecords(source, RAW_PAGE_SIZE, cursor, key));
  return <RawRecordsView view={view} read={read} keyFilter={key} paged={cursor !== null} />;
}
