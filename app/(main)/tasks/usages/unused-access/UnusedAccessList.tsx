'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Pager, tdClass, thClass, When } from '@/app/(main)/tasks/jobs/parts';
import { UNUSED_PAGE_SIZE, usageHref } from '@/lib/usage/view';
import type { UnusedAccess } from '@/lib/types/usage';

/** The holders of a task who did not open it in the window, by username. */
export function UnusedAccessList({ data, page }: { data: UnusedAccess; page: number }) {
  const t = useTranslations('Usage.unused');
  return (
    <>
      <p className="text-sm theme-text-primary" data-testid="unused-summary">
        {t('summary', { total: data.total, holders: data.holders, days: data.days })}
      </p>
      <p className="mb-3 text-xs text-muted">{t('note')}</p>
      {data.accounts.length === 0 ? (
        <p className="py-8 text-center text-muted">{t(data.holders === 0 ? 'noHolders' : 'allUsed')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="unused-table">
            <thead>
              <tr className="border-b border-line">
                <th className={thClass}>{t('columns.username')}</th>
                <th className={thClass}>{t('columns.lastOpened')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.accounts.map((account) => (
                <tr key={account.oid} className="hover:bg-hover">
                  <td className={tdClass}>
                    <Link href={`/tasks/access/accounts/${account.oid}`} className="text-accent hover:underline">
                      {account.username}
                    </Link>
                  </td>
                  <td className={`${tdClass} text-ink-2`}>
                    {account.last_opened_at ? <When iso={account.last_opened_at} /> : t('never')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        page={page}
        total={data.total}
        size={UNUSED_PAGE_SIZE}
        href={(to) => usageHref('unused-access', { task: data.task, days: data.days, page: to })}
      />
    </>
  );
}
