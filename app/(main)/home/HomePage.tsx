'use client';

/**
 * The home page: a greeting, one Pinned row of cards (the person's own pins
 * first, then the tasks an administrator set for them), the recent tasks, and
 * every other task under its grouping. A task opens its page; the star pins
 * and unpins it. Once the cards are drawn the page asks for the tasks' key
 * metrics, once; a card with none, or a failed call, stays plain.
 */

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { setTaskPinned } from '@/app/actions/tasks';
import { TaskTile } from '@/components/tasks/TaskTile';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { byGrouping, groupingName, named, pageHref } from '@/lib/tasks/catalog';
import { greetingAt, hourIn, pinnedRow } from '@/lib/tasks/home';
import { ago, metricChange, metricValue, metricsByTask } from '@/lib/tasks/metrics';
import type { Task, TaskHome, TaskMetric, TaskMetrics } from '@/lib/types/tasks';

interface HomePageProps {
    home: TaskHome;
}

const PERIODS: Record<string, 'now' | 'month' | 'last7Days'> = { now: 'now', month: 'month', last_7_days: 'last7Days' };

export function HomePage({ home }: HomePageProps) {
    const t = useTranslations('Home');
    const locale = useLocale();
    const zh = locale.startsWith('zh');
    const { timezone, ready } = useTimezone();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [metrics, setMetrics] = useState<Map<string, TaskMetric[]>>(new Map());
    // The time the page was opened: the greeting, the date and the metrics' age are read from it.
    const [now] = useState(() => new Date());
    const pinned = new Set(home.pinned.map(task => task.code));

    useEffect(() => {
        let shown = true;
        fetch('/api/tasks/metrics')
            .then(response => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
            .then((answer: TaskMetrics) => { if (shown) setMetrics(metricsByTask(answer.metrics)); })
            .catch(() => { /* The cards stay plain. */ });
        return () => { shown = false; };
    }, []);

    const togglePin = (task: Task) => {
        setError(null);
        startTransition(async () => {
            const outcome = await setTaskPinned(task.code, !pinned.has(task.code));
            if ('error' in outcome) setError(outcome.error);
        });
    };

    /** The task's name, as the link that opens it; `cover` makes its whole card the link. */
    const link = (task: Task, cover = false) => (
        <Link
            href={pageHref(task.address)}
            className={`font-semibold text-ink hover:text-accent ${cover ? 'after:absolute after:inset-0 after:rounded-[14px]' : ''}`}
        >
            {named(task.name, locale)}
        </Link>
    );

    const otherName = (task: Task) => (zh ? task.name.en : task.name.zh);

    const star = (task: Task) => {
        const isPinned = pinned.has(task.code);
        return (
            <button
                onClick={() => togglePin(task)}
                disabled={isPending}
                aria-pressed={isPinned}
                aria-label={t(isPinned ? 'unpinTask' : 'pinTask', { name: named(task.name, locale) })}
                className={`relative z-10 shrink-0 rounded-md p-1 disabled:opacity-50 ${isPinned ? 'text-accent' : 'text-muted hover:text-accent'}`}
            >
                <Star className="h-4 w-4" fill={isPinned ? 'currentColor' : 'none'} />
            </button>
        );
    };

    const metric = (held: TaskMetric, large: boolean) => {
        const period = PERIODS[held.period.kind];
        const change = metricChange(held, locale);
        return (
            <div
                key={held.code}
                data-testid="task-metric"
                title={t('metrics.updated', { when: ago(held.computed_at, now, locale) })}
                className="flex items-baseline gap-2 whitespace-nowrap"
            >
                <b className={`font-semibold text-ink ${large ? 'text-[22px] leading-7' : 'text-sm'}`}>{metricValue(held, locale)}</b>
                <span className="text-xs text-muted">
                    {named(held.label, locale)}
                    {period && `${t('metrics.join')}${t(`metrics.period.${period}`)}`}
                </span>
                {change && <span className="text-xs text-ink-2">{change}</span>}
            </div>
        );
    };

    const card = (task: Task, own: boolean) => {
        const held = metrics.get(task.code);
        return (
            <li
                key={task.code}
                data-testid="home-card"
                data-task={task.code}
                className="relative flex min-h-[132px] flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-4 pb-3.5 shadow-card hover:border-accent"
            >
                <div className="flex items-start justify-between gap-2">
                    <TaskTile name={named(task.name, locale)} />
                    {own ? star(task) : (
                        <span data-testid="home-set-for-you" className="rounded-[9px] border border-line px-2 py-px text-[11px] text-muted">
                            {t('setForYou')}
                        </span>
                    )}
                </div>
                <div className="mt-1 text-[15px] leading-snug">{link(task, true)}</div>
                <div className="text-xs text-muted">{groupingName(task.grouping, locale)} · {otherName(task)}</div>
                {held && (
                    <div className="mt-auto border-t border-dashed border-line pt-2">
                        {held.map(one => metric(one, true))}
                    </div>
                )}
            </li>
        );
    };

    /** A task as a row of a list; `aside` is what the row shows at its right before the star. */
    const row = (task: Task, aside: React.ReactNode) => (
        <li key={task.code} data-testid="home-row" data-task={task.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-2.5 first:border-t-0">
            <TaskTile name={named(task.name, locale)} small />
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{link(task)}</div>
                <div className="truncate text-xs text-muted">{otherName(task)}</div>
            </div>
            {aside}
            {star(task)}
            {metrics.has(task.code) && (
                // The metrics take their own line under the name, so a long label never squeezes it.
                <div className="flex w-full flex-wrap gap-x-5 gap-y-0.5 pl-[42px]">
                    {metrics.get(task.code)!.map(one => metric(one, false))}
                </div>
            )}
        </li>
    );

    const list = (tasks: Task[], aside: (task: Task) => React.ReactNode) => (
        <ul className="rounded-[14px] border border-line bg-surface shadow-card">
            {tasks.map(task => row(task, aside(task)))}
        </ul>
    );

    const heading = 'mb-3 mt-6 flex items-center gap-2.5 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted';
    const count = (shown: number) => (
        <span className="rounded-[10px] bg-[var(--btn-neutral-bg)] px-2 py-px text-xs font-medium normal-case tracking-normal text-ink-2">{shown}</span>
    );
    const pins = pinnedRow(home);

    return (
        <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-[1180px] px-6 pb-10 sm:px-8">
            <header className="pb-2 pt-8">
                {/* The greeting waits for the person's timezone, which only the browser knows. */}
                <h1 data-testid="home-greeting" className="min-h-9 text-[28px] font-semibold leading-9 text-ink">
                    {ready && t(`greeting.${greetingAt(hourIn(now, timezone))}`)}
                </h1>
                <p data-testid="home-date" className="mt-1 min-h-6 text-ink-2">
                    {ready && new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }).format(now)}
                </p>
            </header>
            {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}

            <section data-testid="home-pinned">
                <h2 className={heading}>{t('pinned.title')} {pins.length > 0 && count(pins.length)}</h2>
                {pins.length === 0 ? (
                    <p className="text-sm text-muted">{t('pinned.empty')}</p>
                ) : (
                    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {pins.map(({ task, own }) => card(task, own))}
                    </ul>
                )}
            </section>

            <div className="grid grid-cols-1 items-start gap-x-4 lg:grid-cols-2">
                <section data-testid="home-recent">
                    <h2 className={heading}>{t('recent.title')}</h2>
                    {home.recent.length === 0 ? (
                        <p className="text-sm text-muted">{t('recent.empty')}</p>
                    ) : (
                        list(home.recent, task => <span className="text-xs text-muted">{groupingName(task.grouping, locale)}</span>)
                    )}
                </section>
                <div data-testid="home-other" className="contents">
                    {byGrouping(home.other).map(({ grouping, tasks }) => (
                        <section key={grouping} data-testid={`home-grouping-${grouping}`}>
                            <h2 className={heading}>
                                {t('other.title')} · {groupingName(grouping, locale)} {count(tasks.length)}
                            </h2>
                            {list(tasks, task => (
                                <span className="rounded-[9px] bg-[var(--tag-bg)] px-2 py-px text-[11px] text-ink-2">{t(task.kind)}</span>
                            ))}
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
