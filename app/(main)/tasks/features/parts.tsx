'use client';

/**
 * Manage Features: the frame both views share (title, the two views, refresh) and
 * the small pieces: phase badges and the phase strip.
 */

import { useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Flag, RefreshCw } from 'lucide-react';
import { featureHref, migrationsHref, PHASES, phaseState } from '@/lib/features/view';
import type { Phase } from '@/lib/types/features';

export function FeaturesFrame({ tab, children }: { tab: 'features' | 'migrations'; children: ReactNode }) {
  const t = useTranslations('Features');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const tabClass = (on: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${on ? 'bg-blue-500/20 text-accent' : 'text-ink-2 hover:bg-hover'}`;
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
            <nav className="flex gap-1" aria-label={t('title')}>
              <Link href={featureHref()} className={tabClass(tab === 'features')} aria-current={tab === 'features' ? 'page' : undefined}>
                {t('tabs.features')}
              </Link>
              <Link href={migrationsHref()} className={tabClass(tab === 'migrations')} aria-current={tab === 'migrations' ? 'page' : undefined}>
                {t('tabs.migrations')}
              </Link>
            </nav>
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

const PHASE_CLASS: Record<Phase, string> = {
  planned: 'bg-gray-500/15 text-ink-2',
  add: 'bg-blue-500/15 text-accent',
  switch: 'bg-amber-500/15 text-warn',
  remove: 'bg-red-500/15 text-bad',
  done: 'bg-green-500/15 text-good',
};

export function PhaseBadge({ phase }: { phase: Phase }) {
  const t = useTranslations('Features.phases');
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${PHASE_CLASS[phase]}`}>{t(phase)}</span>;
}

/** planned → add → switch → remove → done, the current phase marked. */
export function PhaseStrip({ phase }: { phase: Phase }) {
  const t = useTranslations('Features.phases');
  return (
    <ol className="flex flex-wrap items-center gap-2" aria-label={t('strip')}>
      {PHASES.map((p, i) => {
        const state = phaseState(phase, p);
        const style =
          state === 'current'
            ? 'border-accent bg-blue-500/20 text-accent font-semibold'
            : state === 'done'
              ? 'border-line text-good'
              : 'border-line text-muted';
        return (
          <li key={p} className="flex items-center gap-2" aria-current={state === 'current' ? 'step' : undefined}>
            {i > 0 && <span className="text-muted">→</span>}
            <span className={`rounded-lg border px-3 py-1 text-sm ${style}`}>{t(p)}</span>
          </li>
        );
      })}
    </ol>
  );
}
