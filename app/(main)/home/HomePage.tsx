'use client';

/**
 * The home page: the person's tasks in four parts. A task opens its page; a
 * pin keeps it in "Pinned by you". What an admin set is shown, not edited.
 */

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Home as HomeIcon, Pin, PinOff } from 'lucide-react';
import { setTaskPinned } from '@/app/actions/tasks';
import type { Task, TaskHome } from '@/lib/types/tasks';

interface HomePageProps {
    home: TaskHome;
}

export function HomePage({ home }: HomePageProps) {
    const t = useTranslations('Home');
    const zh = useLocale().startsWith('zh');
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const pinned = new Set(home.pinned.map(task => task.code));

    const togglePin = (task: Task) => {
        setError(null);
        startTransition(async () => {
            const outcome = await setTaskPinned(task.code, !pinned.has(task.code));
            if ('error' in outcome) setError(outcome.error);
        });
    };

    const tile = (task: Task, withPin: boolean) => {
        const name = zh ? task.name.zh : task.name.en;
        const isPinned = pinned.has(task.code);
        return (
            <li key={task.code} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 flex flex-col gap-1">
                <Link href={task.opens} className="font-medium text-white hover:text-blue-400">
                    {name}
                </Link>
                <span className="text-xs text-gray-500">
                    {zh ? task.name.en : task.name.zh} · {zh ? task.area.zh : task.area.en}
                </span>
                <div className="mt-1 flex items-center justify-between gap-2">
                    <span
                        className={`px-2 py-0.5 rounded-md text-xs border border-blue-500/30 text-blue-400 ${task.origin === 'external' ? 'border-dashed' : ''}`}
                    >
                        {t(task.origin === 'external' ? 'external' : 'itAware')}
                    </span>
                    {withPin && (
                        <button
                            onClick={() => togglePin(task)}
                            disabled={isPending}
                            aria-pressed={isPinned}
                            aria-label={t(isPinned ? 'unpinTask' : 'pinTask', { name })}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white disabled:opacity-50"
                        >
                            {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                            <span>{t(isPinned ? 'unpin' : 'pin')}</span>
                        </button>
                    )}
                </div>
            </li>
        );
    };

    const part = (key: 'adminSet' | 'pinned' | 'recent' | 'other', tasks: Task[], withPin: boolean) => (
        <section className="mb-6" data-testid={`home-${key}`}>
            <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-400">{t(`${key}.title`)}</h2>
            {tasks.length === 0 ? (
                <p className="text-sm text-gray-500">{t(`${key}.empty`)}</p>
            ) : (
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {tasks.map(task => tile(task, withPin))}
                </ul>
            )}
        </section>
    );

    return (
        <div className="min-h-[calc(100vh-4rem)] p-4">
            <div className="glass-card rounded-xl p-4">
                <div className="mb-6 flex items-center gap-3">
                    <HomeIcon className="w-5 h-5 text-blue-400" />
                    <div>
                        <h1 className="text-xl font-semibold text-white">{t('title')}</h1>
                        <p className="text-sm text-gray-400">{t('subtitle')}</p>
                    </div>
                </div>
                {error && <p role="alert" className="mb-4 text-sm text-red-400">{error}</p>}
                {home.admin_set.length > 0 && part('adminSet', home.admin_set, false)}
                {part('pinned', home.pinned, true)}
                {part('recent', home.recent, true)}
                {part('other', home.other, true)}
            </div>
        </div>
    );
}
