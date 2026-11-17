/**
 * View IT CSAT: the derived ServiceNow CSAT table, csat.responses, as it is
 * (GET /csat/responses), newest submission first, scoped by the person's
 * incidents. What ServiceNow sent, untouched, is in View Raw Records.
 */

import { redirect } from 'next/navigation';
import { getCsatResponses } from '@/lib/api/data-tasks';
import { load } from '@/lib/api/usage';
import { CSAT_PAGE_SIZE, param, parsePage, withQuery } from '@/lib/data-tasks/view';
import { CsatResponsesView } from './CsatResponsesView';

export const dynamic = 'force-dynamic';

type Params = Record<string, string | string[] | undefined>;

export default async function ItCsatPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const incident = param(params.incident);
  const read = await load(() => getCsatResponses(CSAT_PAGE_SIZE, (page - 1) * CSAT_PAGE_SIZE, incident));
  // A page past the end is the last page.
  const last = read.ok ? Math.max(1, Math.ceil(read.data.total / CSAT_PAGE_SIZE)) : page;
  if (page > last) redirect(withQuery('/tasks/it-csat', { incident, page: last }));
  return <CsatResponsesView read={read} page={page} incident={incident} />;
}
