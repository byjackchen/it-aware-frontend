'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { tdClass, When } from '@/app/(main)/tasks/jobs/parts';
import { pageHref } from '@/lib/tasks/catalog';
import {
  DEFAULT_SORT,
  formatShare,
  neverOpened,
  nextSort,
  sortRows,
  taskRows,
  usageHref,
  type SortKey,
  type WindowDays,
} from '@/lib/usage/view';
import type { UsageByTask } from '@/lib/types/usage';

const COLUMNS: { key: SortKey; numeric: boolean }[] = [
  { key: 'name', numeric: false },
  { key: 'grouping', numeric: false },
  { key: 'opens', numeric: true },
  { key: 'people', numeric: true },
  { key: 'holders', numeric: true },
  { key: 'share', numeric: true },
  { key: 'last_opened_at', numeric: false },
];

/** A header cell; a column of numbers is headed on the right, over its numbers. */
const th = (numeric: boolean) =>
  `px-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-2 ${numeric ? 'text-right' : 'text-left'}`;

/** Every task with its usage in the window: sortable, and filtered to the ones nobody opened. */
export function UsageByTaskTable({ data, days }: { data: UsageByTask; days: WindowDays }) {
  const t = useTranslations('Usage.tasks');
  const locale = useLocale();
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [unopenedOnly, setUnopenedOnly] = useState(false);

  const rows = taskRows(data.tasks, locale);
  const shown = sortRows(unopenedOnly ? neverOpened(rows) : rows, sort, locale);
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={unopenedOnly} onChange={(e) => setUnopenedOnly(e.target.checked)} />
          {t('neverOpened')}
        </label>
        <span className="text-xs text-muted">{t('count', { shown: shown.length, total: rows.length })}</span>
      </div>
      {shown.length === 0 ? (
        <p className="py-8 text-center text-muted">{t('noMatch')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="usage-tasks-table">
            <thead>
              <tr className="border-b border-line">
                {COLUMNS.map(({ key, numeric }) => {
                  const active = sort.key === key;
                  const Arrow = sort.direction === 'ascending' ? ArrowUp : ArrowDown;
                  return (
                    <th key={key} className={th(numeric)} aria-sort={active ? sort.direction : 'none'}>
                      <button
                        onClick={() => setSort(nextSort(sort, key))}
                        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink ${active ? 'text-ink' : ''}`}
                      >
                        {t(`columns.${key}`)}
                        {active && <Arrow className="h-3 w-3" />}
                      </button>
                    </th>
                  );
                })}
                <th className={th(true)}>
                  <span className="sr-only">{t('unusedAccess')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((row) => (
                <tr key={row.task} className="hover:bg-hover" data-testid={`usage-task-row-${row.task}`}>
                  <td className={tdClass}>
                    {row.address ? (
                      <Link href={pageHref(row.address)} className="text-accent hover:underline">{row.name}</Link>
                    ) : (
                      <span className="font-mono theme-text-primary">{row.name}</span>
                    )}
                  </td>
                  <td className={`${tdClass} text-ink-2`}>{row.grouping || '—'}</td>
                  <td className={`${tdClass} text-right theme-text-primary`} data-testid="usage-task-opens">{row.opens.toLocaleString()}</td>
                  <td className={`${tdClass} text-right theme-text-primary`}>{row.people.toLocaleString()}</td>
                  <td className={`${tdClass} text-right theme-text-primary`}>{row.holders.toLocaleString()}</td>
                  <td className={`${tdClass} text-right theme-text-primary`} data-testid="usage-task-share">{formatShare(row.share)}</td>
                  <td className={`${tdClass} whitespace-nowrap text-ink-2`}>
                    {row.last_opened_at ? <When iso={row.last_opened_at} /> : t('never')}
                  </td>
                  <td className={`${tdClass} whitespace-nowrap text-right`}>
                    <Link href={usageHref('unused-access', { task: row.task, days })} className="text-accent hover:underline">
                      {t('unusedAccess')}
                    </Link>
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
