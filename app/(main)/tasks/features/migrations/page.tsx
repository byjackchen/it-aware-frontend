/**
 * Manage Features, Migrations: every migration run kept by `python -m app.migrate`,
 * newest first, or one run's whole record (`?run=<oid>`).
 */

import { getMigrationRun, listMigrationRuns, read } from '@/lib/api/features';
import { parseMigrationsView, RUNS_PAGE_SIZE } from '@/lib/features/view';
import { LoadFailure } from '../../jobs/parts';
import { MigrationRuns, MigrationRunView } from '../Migrations';
import { FeaturesFrame } from '../parts';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function MigrationRunsPage({ searchParams }: PageProps) {
  const { run, page } = parseMigrationsView(await searchParams);
  if (run) {
    const detail = await read(() => getMigrationRun(run));
    return (
      <FeaturesFrame tab="migrations">
        {detail.ok ? <MigrationRunView run={detail.data} /> : <LoadFailure failure={detail.failure} />}
      </FeaturesFrame>
    );
  }
  const runs = await read(() => listMigrationRuns(RUNS_PAGE_SIZE, (page - 1) * RUNS_PAGE_SIZE));
  return (
    <FeaturesFrame tab="migrations">
      {runs.ok ? <MigrationRuns data={runs.data} page={page} /> : <LoadFailure failure={runs.failure} />}
    </FeaturesFrame>
  );
}
