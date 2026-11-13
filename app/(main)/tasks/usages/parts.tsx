'use client';

/**
 * View Usages: what its views and their sub-pages share — the frame with the
 * view's name (or the sub-page's title and a way back to its view) and the
 * 7/30/90-day selector, a person's name, the labels of an account, and a read
 * that failed.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Activity, ArrowLeft } from 'lucide-react';
import { Notice } from '@/app/(main)/tasks/jobs/parts';
import { named, TASKS } from '@/lib/tasks/catalog';
import { accountLabels, usageHref, WINDOWS, type UsageViewSlug, type WindowDays } from '@/lib/usage/view';
import type { UsageWindow } from '@/lib/types/usage';

const USAGES = TASKS.find((task) => task.code === 'usages');

interface UsageFrameProps {
  view: UsageViewSlug;
  days: WindowDays;
  /** The task picked on Unused Access, kept when the window changes. */
  task?: string | null;
  /** On a sub-page: its segment under the view (kept when the window changes) and its title. */
  sub?: { segment: string; title: string };
  /** The window the backend used, once it answered. */
  range?: UsageWindow;
  children: ReactNode;
}

export function UsageFrame({ view, days, task, sub, range, children }: UsageFrameProps) {
  const t = useTranslations('Usage');
  const locale = useLocale();
  const found = USAGES?.views.find((candidate) => candidate.slug === view)?.name;
  const name = found ? named(found, locale) : view;
  return (
    <div className="p-4">
      <div className="glass-card rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-accent" />
            <div>
              {sub && (
                <Link href={usageHref(view, { days })} className="mb-0.5 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                  <ArrowLeft className="h-3 w-3" />
                  {t('back', { view: name })}
                </Link>
              )}
              <h1 className="text-xl font-semibold theme-text-primary">{sub ? sub.title : name}</h1>
              {!sub && <p className="text-xs text-muted">{t(`help.${view}`)}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <nav className="flex gap-1" aria-label={t('window.label')}>
              {WINDOWS.map((option) => (
                <Link
                  key={option}
                  href={usageHref(view, { days: option, task, sub: sub?.segment })}
                  aria-current={option === days ? 'page' : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${option === days ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-hover'}`}
                >
                  {t('window.days', { days: option })}
                </Link>
              ))}
            </nav>
            {range && (
              <span className="text-xs text-muted" data-testid="usage-window">
                {t('window.dates', { start: range.start, end: range.end })}
              </span>
            )}
          </div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/** A read the page could not make, with the backend's own message. */
export function LoadFailure({ message }: { message: string }) {
  const t = useTranslations('Usage');
  return <Notice tone="error">{t('loadFailed', { message })}</Notice>;
}

/** An account's username; a deleted account's events remain without one. */
export function PersonName({ username }: { username: string | null }) {
  const t = useTranslations('Usage');
  return username ?? <span className="italic text-muted">{t('deletedAccount')}</span>;
}

/** What tells an account apart from a real, active user: Inactive, Integration. */
export function AccountLabels({ account }: { account: { active: boolean; account_type: string } }) {
  const t = useTranslations('Usage.labels');
  return accountLabels(account).map((label) => {
    const text = 'key' in label ? t(label.key) : label.text;
    return (
      <span key={text} data-testid="account-label" className="ml-2 rounded-[9px] bg-[var(--tag-bg)] px-2 py-px text-[11px] text-ink-2">
        {text}
      </span>
    );
  });
}
