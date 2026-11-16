'use client';

/**
 * Manage Features: the frame both views share (title and refresh; the task frame
 * around it switches the two views).
 */

import { useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Flag, RefreshCw } from 'lucide-react';

export function FeaturesFrame({ children }: { children: ReactNode }) {
  const t = useTranslations('Features');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="p-4">
      <div className="glass-card rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <div className="flex items-center gap-3">
            <Flag className="h-5 w-5 text-accent" />
            <div>
              <h1 className="text-xl font-semibold theme-text-primary">{t('title')}</h1>
              <p className="text-xs text-muted">{t('help')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => startTransition(() => router.refresh())}
              disabled={pending}
              className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-1.5 text-accent hover:bg-blue-500/30 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
              <span className="text-sm font-medium">{t('refresh')}</span>
            </button>
          </div>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
