'use client';

/** Manage Features, Migrations: every `python -m app.migrate` run, and one run's whole record. */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { migrationsHref, RUNS_PAGE_SIZE } from '@/lib/features/view';
import type { MigrationRunDetail, MigrationRunsResponse } from '@/lib/types/features';
import { Pager, tdClass, thClass, When } from '../jobs/parts';

export function MigrationRuns({ data, page }: { data: MigrationRunsResponse; page: number }) {
  const t = useTranslations('Features.migrations');
  if (data.total === 0) return <p className="text-sm text-muted">{t('none')}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full" aria-label={t('label')}>
        <thead>
          <tr className="border-b border-line">
            <th className={thClass}>{t('started')}</th>
            <th className={thClass}>{t('revisions')}</th>
            <th className={thClass}>{t('outcome')}</th>
            <th className={thClass}>{t('commit')}</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((run) => (
            <tr key={run.oid} className="border-b border-line">
              <td className={tdClass}>
                <Link href={migrationsHref({ run: run.oid })} className="text-accent hover:underline">
                  <When iso={run.started} />
                </Link>
              </td>
              <td className={`${tdClass} font-mono`}>
                {run.revision_before ?? 'base'} → {run.revision_after ?? run.revision_before ?? 'base'}
              </td>
              <td className={tdClass}>{run.outcome}</td>
              <td className={`${tdClass} font-mono text-xs`}>{run.commit?.slice(0, 12) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Pager page={page} total={data.total} size={RUNS_PAGE_SIZE} href={(p) => migrationsHref({ page: p })} />
    </div>
  );
}

export function MigrationRunView({ run }: { run: MigrationRunDetail }) {
  const t = useTranslations('Features.migrations');
  return (
    <div>
      <Link href={migrationsHref()} className="text-sm text-accent hover:underline">
        ← {t('all')}
      </Link>
      <h2 className="mt-2 text-lg font-semibold theme-text-primary">
        {run.revision_before ?? 'base'} → {run.revision_after ?? run.revision_before ?? 'base'} · {run.outcome}
      </h2>
      <p className="text-xs text-muted">
        <When iso={run.started} /> – <When iso={run.finished} /> · {run.commit ?? '—'}
      </p>
      <pre className="mt-3 max-h-[60vh] overflow-auto rounded-lg border border-line p-3 text-xs" aria-label={t('record')}>
        {JSON.stringify(run.record, null, 2)}
      </pre>
    </div>
  );
}
