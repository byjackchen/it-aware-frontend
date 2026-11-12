'use client';

/**
 * Manage Jobs: the pieces every screen shares — the frame, state badges, times,
 * notices, the pager, and a confirmed action with its outcome.
 */

import { useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Workflow, X } from 'lucide-react';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { usePermissions } from '@/lib/contexts/user-context';
import { formatLocalDateTime } from '@/lib/utils/datetime';
import { jobsHref, type JobsLink } from '@/lib/jobs/paths';
import { formatDuration, isUnavailable, JOBS_RUN_PERMISSION, stateTone, type Tone } from '@/lib/jobs/view';
import type { JobsResult } from '@/app/actions/jobs';
import type { JobActionRecord, JobsFailure } from '@/lib/types/jobs';

// ── Frame ────────────────────────────────────────────────────────────────────

export function JobsFrame({ tab, children }: { tab: 'jobs' | 'actions'; children: ReactNode }) {
  const t = useTranslations('Jobs');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const tabClass = (on: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${on ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:bg-white/5'}`;
  return (
    <div className="p-4">
      <div className="glass-card rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Workflow className="h-5 w-5 text-blue-400" />
            <div>
              <h1 className="text-xl font-semibold theme-text-primary">{t('title')}</h1>
              <p className="text-xs text-gray-500">{t('help')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex gap-1" aria-label={t('title')}>
              <Link href={jobsHref()} className={tabClass(tab === 'jobs')} aria-current={tab === 'jobs' ? 'page' : undefined}>
                {t('tabs.jobs')}
              </Link>
              <Link
                href={jobsHref({ tab: 'actions' })}
                className={tabClass(tab === 'actions')}
                aria-current={tab === 'actions' ? 'page' : undefined}
              >
                {t('tabs.actions')}
              </Link>
            </nav>
            <button
              onClick={() => startTransition(() => router.refresh())}
              disabled={pending}
              className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-1.5 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50"
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

// ── Small parts ──────────────────────────────────────────────────────────────

const TONE_CLASS: Record<Tone, string> = {
  success: 'bg-green-500/15 text-green-400',
  failed: 'bg-red-500/15 text-red-400',
  running: 'bg-blue-500/15 text-blue-400',
  waiting: 'bg-amber-500/15 text-amber-400',
  none: 'bg-gray-500/15 text-gray-400',
};

/** A run or step state; `empty` stands in when there is none (a job with no run says so). */
export function StateBadge({ state, empty = '—' }: { state: string | null; empty?: string }) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TONE_CLASS[stateTone(state)]}`}>
      {state ?? empty}
    </span>
  );
}

export function When({ iso }: { iso: string | null }) {
  const { timezone } = useTimezone();
  const text = formatLocalDateTime(iso, timezone).replace('T', ' ');
  return <span title={text ? timezone : undefined}>{text || '—'}</span>;
}

export function Duration({ seconds }: { seconds: number | null }) {
  return <>{formatDuration(seconds) ?? '—'}</>;
}

export function Notice({ tone, children }: { tone: 'warning' | 'error' | 'success'; children: ReactNode }) {
  const style = {
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
    error: 'border-red-500/30 bg-red-500/10 text-red-400',
    success: 'border-green-500/30 bg-green-500/10 text-green-400',
  }[tone];
  const Icon = tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <div role={tone === 'success' ? 'status' : 'alert'} className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${style}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/** A read the page could not make, with the backend's own message. */
export function LoadFailure({ failure }: { failure: JobsFailure }) {
  const t = useTranslations('Jobs');
  return <Notice tone="error">{t('loadFailed', { message: failure.message })}</Notice>;
}

export function Pager({ page, total, size, link }: { page: number; total: number; size: number; link: JobsLink }) {
  const t = useTranslations('Jobs.pager');
  const pages = Math.max(1, Math.ceil(total / size));
  if (pages <= 1) return null;
  const linkClass = 'rounded-lg px-3 py-1 text-sm text-blue-400 hover:bg-white/5';
  return (
    <div className="mt-3 flex items-center justify-end gap-2 text-sm text-gray-400">
      {page > 1 && <Link className={linkClass} href={jobsHref({ ...link, page: page - 1 })}>{t('previous')}</Link>}
      <span>{t('page', { page, pages })}</span>
      {page < pages && <Link className={linkClass} href={jobsHref({ ...link, page: page + 1 })}>{t('next')}</Link>}
    </div>
  );
}

export const thClass = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-400';
export const tdClass = 'px-3 py-2 text-sm';

// ── Confirmed actions ────────────────────────────────────────────────────────

export type ActionKey = 'pause' | 'resume' | 'run' | 'retry_failed' | 'stop';

interface Asking {
  key: ActionKey;
  question: string;
  /** Extra content in the dialog (the run-now form). */
  body?: ReactNode;
  /** Answers the call to make, or why the dialog's own input can't be sent. */
  prepare: () => (() => Promise<JobsResult<JobActionRecord>>) | string;
}

type Outcome = { tone: 'success' | 'warning' | 'error'; text: string };

/**
 * Who may act (`systems:jobs:run`), the confirmation that names the job, and
 * what came of it. An action Airflow refuses IT-Aware (503 `airflow_refused`)
 * is marked unavailable for the rest of the visit.
 */
export function useJobActions() {
  const t = useTranslations('Jobs');
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const [asking, setAskingState] = useState<Asking | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const setAsking = (next: Asking | null) => {
    setDialogError(null);
    setAskingState(next);
  };
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [unavailable, setUnavailable] = useState<Partial<Record<ActionKey, string>>>({});
  const [pending, startTransition] = useTransition();
  // While an action is under way the dialog stays, and nothing else can be asked:
  // a slow "Run now" cannot be confirmed twice.
  const dismiss = () => {
    if (!pending) setAsking(null);
  };
  const ask = (next: Asking) => {
    if (!pending) setAsking(next);
  };

  const confirm = () => {
    const current = asking;
    if (!current || pending) return;
    const call = current.prepare();
    if (typeof call === 'string') {
      setDialogError(call);
      return;
    }
    const label = t(`actions.${current.key}`);
    startTransition(async () => {
      const result = await call();
      setAsking(null);
      if (result.ok) {
        const outcomeText = t(`record.outcome.${result.data.outcome}`);
        setOutcome({ tone: 'success', text: t('actions.done', { action: label, outcome: outcomeText }) });
        router.refresh();
      } else if (isUnavailable(result.failure)) {
        setUnavailable((u) => ({ ...u, [current.key]: result.failure.message }));
        setOutcome({ tone: 'warning', text: t('actions.unavailable', { action: label, message: result.failure.message }) });
      } else {
        setOutcome({ tone: 'error', text: t('actions.failed', { action: label, message: result.failure.message }) });
      }
    });
  };

  const view = (
    <>
      {outcome && (
        <Notice tone={outcome.tone}>
          <span data-testid="job-action-outcome">{outcome.text}</span>
        </Notice>
      )}
      {asking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={dismiss}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('actions.confirmTitle')}
            className="glass-card w-full max-w-lg rounded-xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold theme-text-primary">{t(`actions.${asking.key}`)}</h2>
              <button
                onClick={dismiss}
                disabled={pending}
                className="text-gray-400 hover:text-white disabled:opacity-40"
                aria-label={t('actions.cancel')}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm theme-text-primary">{asking.question}</p>
            {asking.body}
            {dialogError && <p role="alert" className="mt-3 text-sm text-red-400">{dialogError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={dismiss}
                disabled={pending}
                className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-white/5 disabled:opacity-40"
              >
                {t('actions.cancel')}
              </button>
              <button
                onClick={confirm}
                disabled={pending}
                className="flex items-center gap-2 rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50"
              >
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                {pending ? t('actions.working') : t('actions.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return { canRun: hasPermission(JOBS_RUN_PERMISSION), ask, busy: pending, unavailable, view };
}

/** An action's button: disabled, with the reason beside it, when it can't be taken. */
export function ActionButton({
  label,
  onClick,
  refusal,
  busy = false,
  tone = 'default',
}: {
  label: string;
  onClick: () => void;
  refusal?: string | null;
  /** An action is under way on this page: every action waits for it. */
  busy?: boolean;
  tone?: 'default' | 'danger';
}) {
  const colour = tone === 'danger' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30';
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        onClick={onClick}
        disabled={!!refusal || busy}
        title={refusal ?? undefined}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${colour}`}
      >
        {label}
      </button>
      {refusal && <span className="max-w-xs text-xs text-amber-400">{refusal}</span>}
    </span>
  );
}
