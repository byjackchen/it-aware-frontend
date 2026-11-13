'use client';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { byGrouping, groupingName, named, TASKS } from '@/lib/tasks/catalog';
import { usageHref, type WindowDays } from '@/lib/usage/view';

/** The task whose holders are listed: every task of the catalog, by grouping. */
export function TaskPicker({ task, days }: { task: string | null; days: WindowDays }) {
  const t = useTranslations('Usage.unused');
  const locale = useLocale();
  const router = useRouter();
  return (
    <div className="mb-4">
      <label className="flex flex-wrap items-center gap-3 text-sm text-ink-2">
        {t('task')}
        <select
          value={task ?? ''}
          onChange={(e) => router.push(usageHref('unused-access', { task: e.target.value, days }))}
          className="theme-input min-w-72 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">{t('pick')}</option>
          {byGrouping(TASKS).map(({ grouping, tasks }) => (
            <optgroup key={grouping} label={groupingName(grouping, locale)}>
              {tasks.map((candidate) => (
                <option key={candidate.code} value={candidate.code}>{named(candidate.name, locale)}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {!task && <p className="py-8 text-center text-muted">{t('pickHelp')}</p>}
    </div>
  );
}
