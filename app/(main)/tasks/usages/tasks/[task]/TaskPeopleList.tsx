'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Pager, tdClass, thClass, When } from '@/app/(main)/tasks/jobs/parts';
import { PEOPLE_PAGE_SIZE, usageHref, viewNames } from '@/lib/usage/view';
import type { TaskPeople } from '@/lib/types/usage';
import { PersonName } from '../../parts';

const numeric = `${thClass} text-right`;

/** The people who opened one task in the window, the most opens first, each linked to their usage. */
export function TaskPeopleList({ data, page }: { data: TaskPeople; page: number }) {
  const t = useTranslations('Usage.taskPeople');
  const locale = useLocale();
  return (
    <>
      <p className="mb-3 text-sm theme-text-primary" data-testid="task-people-summary">
        {t('summary', { total: data.total, days: data.days })}
      </p>
      {data.people.length === 0 ? (
        <p className="py-8 text-center text-muted">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="task-people-table">
            <thead>
              <tr className="border-b border-line">
                <th className={thClass}>{t('columns.username')}</th>
                <th className={numeric}>{t('columns.opens')}</th>
                <th className={thClass}>{t('columns.views')}</th>
                <th className={thClass}>{t('columns.lastOpened')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.people.map((person) => (
                <tr key={person.oid} className="hover:bg-hover">
                  <td className={tdClass}>
                    <Link href={usageHref('people', { sub: person.oid, days: data.days })} className="text-accent hover:underline">
                      <PersonName username={person.username} />
                    </Link>
                  </td>
                  <td className={`${tdClass} text-right theme-text-primary`}>{person.opens.toLocaleString()}</td>
                  <td className={`${tdClass} text-ink-2`}>{viewNames(data.task, person.views, locale).join(', ') || '—'}</td>
                  <td className={`${tdClass} whitespace-nowrap text-ink-2`}>
                    <When iso={person.last_opened_at} />
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
        size={PEOPLE_PAGE_SIZE}
        href={(to) => usageHref('tasks', { sub: data.task, days: data.days, page: to })}
      />
    </>
  );
}
