'use client';

/**
 * The task frame, in two parts so the page keeps its height for the task:
 *
 * - `TaskHeader`, in the top bar's middle: the task's icon tile, its grouping as
 *   a small caption, its name, and a pin toggle (the star of the home and of
 *   search). An external task (another app's page inside IT-Aware) carries a
 *   small app mark whose hint says whose page it is; where the deployment names
 *   the app's own address, the mark is a link that opens it in a new tab.
 * - `TaskViews`, a slim row under the top bar: a tab per view, and only when the
 *   person has more than one of the task's views. Most tasks have none, so the
 *   page starts right under the top bar.
 *
 * Each task carries its own navigation; there is no global sidebar. Both render
 * nothing on a page that is no task's (the home).
 */

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { AppWindow, ChevronRight, Star } from 'lucide-react';
import { NavLink } from '@/components/navigation/NavLink';
import { TaskTile } from '@/components/tasks/TaskTile';
import { setTaskPinned } from '@/app/actions/tasks';
import { useTheme } from '@/lib/contexts/theme-context';
import { groupingName, named, pageHref, resolvePage } from '@/lib/tasks/catalog';
import { windowQuery } from '@/lib/usage/view';
import type { Task } from '@/lib/types/tasks';

export interface TaskFrameProps {
    /** The person's tasks, each with only their views (GET /tasks/mine); null when unknown. */
    held: Task[] | null;
    /** The codes the person pinned (GET /tasks/home); null when unknown. */
    pinned: string[] | null;
    /** Where a person opens each external task's app on their own, by task code (lib/external/gateway.ts). */
    addresses: Record<string, string>;
}

/** The task of this page, and what the person has of it; null on a page that is no task's. */
function useTaskOfPage(held: Task[] | null) {
    const pathname = usePathname();
    const page = resolvePage(pathname);
    if (!page) return null;
    const { task, view } = page;
    const mine = held?.find(candidate => candidate.code === task.code);
    const views = mine ? task.views.filter(candidate => mine.views.some(own => own.slug === candidate.slug)) : [];
    return { task, view, mine, views };
}

export function TaskHeader({ held, pinned, addresses }: TaskFrameProps) {
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('TaskFrame');
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [isPending, startTransition] = useTransition();
    const page = useTaskOfPage(held);
    if (!page) return null;
    const { task, mine } = page;
    const name = named(task.name, locale);
    // The pin shows what is stored: it changes once the backend has it and
    // the layout's data is fetched again; until then the button waits.
    const isPinned = pinned?.includes(task.code) ?? false;
    const address = task.kind === 'external' ? addresses[task.code] : undefined;

    const togglePin = () => {
        startTransition(async () => {
            const outcome = await setTaskPinned(task.code, !isPinned);
            if (!('error' in outcome)) router.refresh();
        });
    };

    return (
        <div data-testid="task-frame" className="flex min-w-0 items-center gap-2">
            <ChevronRight aria-hidden="true" className={`h-4 w-4 shrink-0 ${isLight ? 'text-slate-300' : 'text-gray-600'}`} />
            <TaskTile name={name} task={task.code} small />
            <div className="flex min-w-0 flex-col leading-tight">
                <span className={`truncate text-[11px] uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                    {groupingName(task.grouping, locale)}
                </span>
                <span className="flex min-w-0 items-center gap-1.5">
                    <span data-testid="task-frame-name" className={`truncate text-[15px] font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {name}
                    </span>
                    {task.kind === 'external' && (address ? (
                        <a
                            data-testid="task-frame-external"
                            href={address}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={t('externalOpen', { name, address: new URL(address).host })}
                            aria-label={t('externalOpen', { name, address: new URL(address).host })}
                            className={`shrink-0 rounded p-0.5 ${isLight ? 'text-slate-400 hover:bg-slate-100 hover:text-accent' : 'text-gray-500 hover:bg-white/10 hover:text-white'}`}
                        >
                            <AppWindow aria-hidden="true" className="h-3.5 w-3.5" />
                        </a>
                    ) : (
                        <span
                            data-testid="task-frame-external"
                            title={t('external', { name })}
                            aria-label={t('external', { name })}
                            className={`shrink-0 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}
                        >
                            <AppWindow aria-hidden="true" className="h-3.5 w-3.5" />
                        </span>
                    ))}
                </span>
            </div>
            {mine && pinned && (
                <button
                    onClick={togglePin}
                    disabled={isPending}
                    aria-pressed={isPinned}
                    aria-label={t(isPinned ? 'unpin' : 'pin')}
                    title={t(isPinned ? 'unpinTask' : 'pinTask', { name })}
                    className={`shrink-0 rounded-md p-1.5 disabled:opacity-50 ${isPinned
                        ? 'text-accent'
                        : isLight
                            ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-800'
                            : 'text-gray-500 hover:bg-white/10 hover:text-white'
                        }`}
                >
                    <Star className="h-4 w-4" fill={isPinned ? 'currentColor' : 'none'} />
                </button>
            )}
        </div>
    );
}

export function TaskViews({ held }: Pick<TaskFrameProps, 'held'>) {
    const searchParams = useSearchParams();
    const locale = useLocale();
    const t = useTranslations('TaskFrame');
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const page = useTaskOfPage(held);
    if (!page || page.views.length < 2) return null;
    const { task, view, views } = page;
    const name = named(task.name, locale);
    // View Usages' views share one window (7, 30 or 90 days): its tabs carry it along.
    const kept = task.code === 'usages' ? windowQuery(searchParams) : '';

    return (
        <div
            data-testid="task-views"
            className={`flex items-center px-4 border-b ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f0f23]/60 border-white/10'}`}
        >
            <nav aria-label={t('views', { name })} className="flex flex-wrap items-center gap-1 py-1">
                {views.map(candidate => {
                    const active = candidate.slug === view.slug;
                    return (
                        <NavLink
                            key={candidate.slug}
                            href={`${pageHref(candidate.address)}${kept}`}
                            aria-current={active ? 'page' : undefined}
                            className={`px-2.5 py-1 rounded-md text-[13px] font-medium transition-colors ${active
                                ? 'sidebar-active'
                                : isLight
                                    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            {named(candidate.name, locale)}
                        </NavLink>
                    );
                })}
            </nav>
        </div>
    );
}
