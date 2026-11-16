'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { tdClass, thClass, When } from '@/app/(main)/tasks/jobs/parts';
import { pageHref } from '@/lib/tasks/catalog';
import { personTaskRows } from '@/lib/usage/view';
import type { Task } from '@/lib/types/tasks';
import type { PersonUsage } from '@/lib/types/usage';

const numeric = `${thClass} text-right`;

/** One person's sign-ins, and each task they opened in the window: opens, views, last opened. */
export function PersonDetail({ data, held }: { data: PersonUsage; held: Task[] | null }) {
  const t = useTranslations('Usage.person');
  const locale = useLocale();
  const rows = personTaskRows(data.tasks, held, locale);
  return (
    <>
      <p className="mb-3 text-sm theme-text-primary" data-testid="person-summary">
        {t('summary', { signIns: data.sign_ins, tasks: data.tasks.length, days: data.days })}
      </p>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-muted">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="person-tasks-table">
            <thead>
              <tr className="border-b border-line">
                <th className={thClass}>{t('columns.task')}</th>
                <th className={numeric}>{t('columns.opens')}</th>
                <th className={thClass}>{t('columns.views')}</th>
                <th className={thClass}>{t('columns.lastOpened')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.task} className="hover:bg-hover" data-testid={`person-task-${row.task}`}>
                  <td className={tdClass}>
                    {row.address ? (
                      <Link href={pageHref(row.address)} className="text-accent hover:underline">{row.name}</Link>
                    ) : (
                      <span className={row.known ? 'theme-text-primary' : 'font-mono theme-text-primary'}>{row.name}</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-right theme-text-primary`}>{row.opens.toLocaleString()}</td>
                  <td className={`${tdClass} text-ink-2`}>{row.viewNames.join(', ') || '—'}</td>
                  <td className={`${tdClass} whitespace-nowrap text-ink-2`}>
                    <When iso={row.last_opened_at} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
