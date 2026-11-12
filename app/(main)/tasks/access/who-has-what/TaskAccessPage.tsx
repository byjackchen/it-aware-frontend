'use client';

/**
 * Who has what tasks: pick a group or a person on the left, see its tasks
 * under their grouping on the right.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ListChecks } from 'lucide-react';
import { byGrouping, groupingName, named as inLanguage, pageHref } from '@/lib/tasks/catalog';
import type { Task, TaskAccess, TaskNames } from '@/lib/types/tasks';

interface TaskAccessPageProps {
    access: TaskAccess;
}

type View = 'group' | 'person';

interface Holder {
    key: string;
    detail: string[];
    inactive: boolean;
    tasks: { code: string; scopes: string[] }[];
    /** A user account's profile page. */
    profile?: string;
}

const scopeTypeColors: Record<string, string> = {
    unconstrained: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    self_scoped: 'bg-green-500/20 text-green-400 border-green-500/30',
    role_based: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export function TaskAccessPage({ access }: TaskAccessPageProps) {
    const t = useTranslations('Auth');
    const locale = useLocale();
    const [view, setView] = useState<View>('group');
    const [filter, setFilter] = useState('');
    const [selected, setSelected] = useState<string | null>(null);

    const named = (names: TaskNames) => inLanguage(names, locale);

    const holders = useMemo<Holder[]>(
        () =>
            view === 'group'
                ? access.groups.map(group => ({
                    key: group.name,
                    detail: [group.scope_type],
                    inactive: false,
                    tasks: group.tasks.map(code => ({ code, scopes: [] })),
                }))
                : access.accounts.map(account => ({
                    key: account.username,
                    detail: account.groups,
                    inactive: !account.is_active,
                    tasks: account.tasks,
                    profile: account.account_type === 'user' ? `/tasks/access/accounts/${account.oid}` : undefined,
                })),
        [access, view]
    );
    const shown = holders.filter(holder => holder.key.toLowerCase().includes(filter.trim().toLowerCase()));
    const holder = holders.find(candidate => candidate.key === selected);

    const taskByCode = useMemo(() => new Map(access.tasks.map(task => [task.code, task])), [access]);
    const byArea = useMemo(() => {
        const held: { task: Task; scopes: string[]; grouping: string }[] = [];
        for (const one of holder?.tasks ?? []) {
            const task = taskByCode.get(one.code);
            if (task) held.push({ task, scopes: one.scopes, grouping: task.grouping });
        }
        return byGrouping(held).map(({ grouping, tasks }) => [groupingName(grouping, locale), tasks] as const);
    }, [holder, taskByCode, locale]);

    const switchView = (next: View) => {
        setView(next);
        setSelected(null);
        setFilter('');
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="h-full glass-card rounded-xl overflow-hidden flex flex-col">
                <div className="p-4 border-b border-white/10 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <ListChecks className="w-5 h-5 text-blue-400" />
                        <div>
                            <h1 className="text-xl font-semibold text-white">{t('tasks.title')}</h1>
                            <p className="text-sm text-gray-400">{t('tasks.subtitle')}</p>
                        </div>
                    </div>
                    <div className="flex rounded-lg border border-white/10 overflow-hidden" role="tablist">
                        {(['group', 'person'] as const).map(option => (
                            <button
                                key={option}
                                role="tab"
                                aria-selected={view === option}
                                onClick={() => switchView(option)}
                                className={`px-4 py-2 text-sm font-medium transition-colors ${view === option
                                    ? 'bg-blue-500/20 text-blue-400'
                                    : 'text-gray-400 hover:bg-white/5'
                                    }`}
                            >
                                {t(option === 'group' ? 'tasks.byGroup' : 'tasks.byPerson')}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 flex min-h-0">
                    <div className="w-80 border-r border-white/10 flex flex-col min-h-0">
                        <div className="p-3 border-b border-white/10">
                            <input
                                value={filter}
                                onChange={event => setFilter(event.target.value)}
                                placeholder={t('tasks.filter')}
                                aria-label={t('tasks.filter')}
                                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                            />
                        </div>
                        <ul className="flex-1 overflow-auto divide-y divide-white/5" data-testid="task-holders">
                            {shown.map(candidate => (
                                <li key={candidate.key}>
                                    <button
                                        onClick={() => setSelected(candidate.key)}
                                        aria-current={candidate.key === selected}
                                        className={`w-full px-4 py-3 text-left transition-colors ${candidate.key === selected ? 'bg-blue-500/10' : 'hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`font-medium ${candidate.inactive ? 'text-gray-500' : 'text-white'}`}>
                                                {candidate.key}
                                            </span>
                                            <span className="text-xs text-gray-400 whitespace-nowrap">
                                                {t('tasks.taskCount', { count: candidate.tasks.length })}
                                            </span>
                                        </div>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {candidate.inactive && (
                                                <span className="px-2 py-0.5 rounded-md text-xs border bg-gray-500/20 text-gray-400 border-gray-500/30">
                                                    {t('tasks.inactive')}
                                                </span>
                                            )}
                                            {candidate.detail.map(item => (
                                                <span
                                                    key={item}
                                                    className={`px-2 py-0.5 rounded-md text-xs border ${scopeTypeColors[item] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                                                        }`}
                                                >
                                                    {view === 'group' ? t(`groups.scope.${item}`) : item}
                                                </span>
                                            ))}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="flex-1 overflow-auto p-4" data-testid="task-list">
                        {holder?.profile && (
                            <p className="mb-4 text-sm">
                                <Link href={holder.profile} className="text-blue-400 hover:underline">
                                    {t('tasks.userProfile', { name: holder.key })}
                                </Link>
                            </p>
                        )}
                        {!holder ? (
                            <p className="text-gray-500">{t('tasks.pick')}</p>
                        ) : byArea.length === 0 ? (
                            <p className="text-gray-500">{t('tasks.noTasks')}</p>
                        ) : (
                            <>
                                {view === 'person' && <p className="mb-4 text-sm text-gray-400">{t('tasks.scopeNote')}</p>}
                                {byArea.map(([area, held]) => (
                                    <section key={area} className="mb-6">
                                        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-gray-400">{area}</h2>
                                        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                            {held.map(({ task, scopes }) => (
                                                <li key={task.code} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                                    <Link href={pageHref(task.address)} className="font-medium text-white hover:text-blue-400">
                                                        {named(task.name)}
                                                    </Link>
                                                    <div className="text-xs text-gray-500">{task.code}</div>
                                                    {scopes.length > 0 && (
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            {scopes.map(scope => (
                                                                <span
                                                                    key={scope}
                                                                    className={`px-2 py-0.5 rounded-md text-xs border ${scopeTypeColors[scope] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                                                                        }`}
                                                                >
                                                                    {t(`groups.scope.${scope}`)}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                ))}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
