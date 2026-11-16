'use client';

import { useLocale, useTranslations } from 'next-intl';
import { byGrouping, groupingName, named, TASKS } from '@/lib/tasks/catalog';
import { DEFAULT_DAYS, usageHref, type WindowDays } from '@/lib/usage/view';

/**
 * The task whose holders are listed: every task of the catalog, by grouping.
 * A form the browser sends itself: the list is asked for on Show, not while
 * the keyboard moves through the options, and it needs no script.
 */
export function TaskPicker({ task, days }: { task: string | null; days: WindowDays }) {
  const t = useTranslations('Usage.unused');
  const locale = useLocale();
  return (
    <div className="mb-4">
      <form action={usageHref('unused-access')} method="get" className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
        <label htmlFor="usage-task">{t('task')}</label>
        <select id="usage-task" name="task" defaultValue={task ?? ''} required className="theme-input min-w-72 rounded-lg px-3 py-2 text-sm">
          <option value="">{t('pick')}</option>
          {byGrouping(TASKS).map(({ grouping, tasks }) => (
            <optgroup key={grouping} label={groupingName(grouping, locale)}>
              {tasks.map((candidate) => (
                <option key={candidate.code} value={candidate.code}>{named(candidate.name, locale)}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {days !== DEFAULT_DAYS && <input type="hidden" name="days" value={days} />}
        <button type="submit" className="rounded-lg bg-accent-soft px-3 py-2 text-sm font-medium text-accent hover:bg-hover">
          {t('show')}
        </button>
      </form>
      {!task && <p className="py-8 text-center text-muted">{t('pickHelp')}</p>}
    </div>
  );
}
