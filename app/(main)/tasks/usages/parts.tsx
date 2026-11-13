'use client';

/**
 * View Usages: what its three views share — the frame with the view's name and
 * the 7/30/90-day selector, and a read that failed.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Activity } from 'lucide-react';
import { Notice } from '@/app/(main)/tasks/jobs/parts';
import { named, TASKS } from '@/lib/tasks/catalog';
import { usageHref, WINDOWS, type UsageViewSlug, type WindowDays } from '@/lib/usage/view';
import type { UsageWindow } from '@/lib/types/usage';

const USAGES = TASKS.find((task) => task.code === 'usages');

interface UsageFrameProps {
  view: UsageViewSlug;
  days: WindowDays;
  /** The task picked on Unused Access, kept when the window changes. */
  task?: string | null;
  /** The window the backend used, once it answered. */
  window?: UsageWindow;
  children: ReactNode;
}

export function UsageFrame({ view, days, task, window, children }: UsageFrameProps) {
  const t = useTranslations('Usage');
  const locale = useLocale();
  const name = USAGES?.views.find((candidate) => candidate.slug === view)?.name;
  return (
    <div className="p-4">
      <div className="glass-card rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-accent" />
            <div>
              <h1 className="text-xl font-semibold theme-text-primary">{name ? named(name, locale) : view}</h1>
              <p className="text-xs text-muted">{t(`help.${view}`)}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <nav className="flex gap-1" aria-label={t('window.label')}>
              {WINDOWS.map((option) => (
                <Link
                  key={option}
                  href={usageHref(view, { days: option, task })}
                  aria-current={option === days ? 'page' : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${option === days ? 'bg-accent-soft text-accent' : 'text-ink-2 hover:bg-hover'}`}
                >
                  {t('window.days', { days: option })}
                </Link>
              ))}
            </nav>
            {window && (
              <span className="text-xs text-muted" data-testid="usage-window">
                {t('window.dates', { start: window.start, end: window.end })}
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
