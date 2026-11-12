'use client';

/**
 * The task frame: on a page that belongs to a task, a header with the task's
 * name, its grouping as a small caption, a pin toggle, and, when the person
 * has more than one of the task's views, a tab per view. It replaces the
 * global sidebar: each task carries its own navigation. Renders nothing on a
 * page that is no task's (the home).
 */

import { useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Pin, PinOff } from 'lucide-react';
import { NavLink } from '@/components/navigation/NavLink';
import { setTaskPinned } from '@/app/actions/tasks';
import { useTheme } from '@/lib/contexts/theme-context';
import { groupingName, named, pageHref, resolvePage } from '@/lib/tasks/catalog';
import type { Task } from '@/lib/types/tasks';

export interface TaskFrameProps {
    /** The person's tasks, each with only their views (GET /tasks/mine); null when unknown. */
    held: Task[] | null;
    /** The codes the person pinned (GET /tasks/home); null when unknown. */
    pinned: string[] | null;
}

export function TaskFrame({ held, pinned }: TaskFrameProps) {
    const pathname = usePathname();
    const router = useRouter();
    const locale = useLocale();
    const t = useTranslations('TaskFrame');
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [isPending, startTransition] = useTransition();

    const page = resolvePage(pathname);
    if (!page) return null;
    const { task, view } = page;
    const name = named(task.name, locale);
    const mine = held?.find(candidate => candidate.code === task.code);
    const views = mine ? task.views.filter(candidate => mine.views.some(own => own.slug === candidate.slug)) : [];
    // The pin shows what is stored: it changes once the backend has it and
    // the layout's data is fetched again; until then the button waits.
    const isPinned = pinned?.includes(task.code) ?? false;

    const togglePin = () => {
        startTransition(async () => {
            const outcome = await setTaskPinned(task.code, !isPinned);
            if (!('error' in outcome)) router.refresh();
        });
    };

    return (
        <div
            data-testid="task-frame"
            className={`flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 border-b ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f0f23]/60 border-white/10'}`}
        >
            <div className="flex flex-col leading-tight">
                <span className={`text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                    {groupingName(task.grouping, locale)}
                </span>
                <span data-testid="task-frame-name" className={`text-base font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    {name}
                </span>
            </div>

            {views.length > 1 && (
                <nav aria-label={t('views', { name })} className="flex flex-wrap items-center gap-1">
                    {views.map(candidate => {
                        const active = candidate.slug === view.slug;
                        return (
                            <NavLink
                                key={candidate.slug}
                                href={pageHref(candidate.address)}
                                aria-current={active ? 'page' : undefined}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${active
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
            )}

            {mine && pinned && (
                <button
                    onClick={togglePin}
                    disabled={isPending}
                    aria-pressed={isPinned}
                    title={t(isPinned ? 'unpinTask' : 'pinTask', { name })}
                    className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-md text-xs border disabled:opacity-50 ${isPinned
                        ? 'border-blue-500/30 text-blue-400'
                        : isLight
                            ? 'border-slate-200 text-slate-500 hover:text-slate-800'
                            : 'border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                        }`}
                >
                    {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                    <span>{t(isPinned ? 'unpin' : 'pin')}</span>
                </button>
            )}
        </div>
    );
}
