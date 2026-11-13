'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Pager, tdClass, thClass, When } from '@/app/(main)/tasks/jobs/parts';
import { PEOPLE_PAGE_SIZE, usageHref } from '@/lib/usage/view';
import type { UsagePeople } from '@/lib/types/usage';
import { PersonName } from '../parts';

const numeric = `${thClass} text-right`;
const number = `${tdClass} text-right theme-text-primary`;

/** Everyone active in the window, in the backend's order (the most task opens first). */
export function PeopleList({ data, page }: { data: UsagePeople; page: number }) {
  const t = useTranslations('Usage.people');
  return (
    <>
      <p className="mb-3 text-sm theme-text-primary" data-testid="people-summary">
        {t('summary', { total: data.total, days: data.days })}
      </p>
      {data.people.length === 0 ? (
        <p className="py-8 text-center text-muted">{t('empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="people-table">
            <thead>
              <tr className="border-b border-line">
                <th className={thClass}>{t('columns.username')}</th>
                <th className={numeric}>{t('columns.signIns')}</th>
                <th className={numeric}>{t('columns.taskOpens')}</th>
                <th className={numeric}>{t('columns.tasks')}</th>
                <th className={thClass}>{t('columns.lastActive')}</th>
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
                  <td className={number}>{person.sign_ins.toLocaleString()}</td>
                  <td className={number}>{person.task_opens.toLocaleString()}</td>
                  <td className={number}>{person.tasks.toLocaleString()}</td>
                  <td className={`${tdClass} whitespace-nowrap text-ink-2`}>
                    <When iso={person.last_active_at} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={data.total} size={PEOPLE_PAGE_SIZE} href={(to) => usageHref('people', { days: data.days, page: to })} />
    </>
  );
}
