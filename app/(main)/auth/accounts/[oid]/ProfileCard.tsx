'use client';

/**
 * The customization part of a user's profile, set by an admin: the start page,
 * the service line and the tasks on the user's home. Only tasks the user can
 * open are offered. The user never sees this; they see its effect on their
 * home page. The security part of the profile is the rest of the account page.
 */

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Loader2, Save } from 'lucide-react';
import { saveAccountProfile } from '@/app/actions/tasks';
import type { AccountProfile, ServiceLine, Task } from '@/lib/types/tasks';

export interface ProfileCardProps {
    profile: AccountProfile;
    /** The tasks this user can open now. */
    tasks: Task[];
    serviceLines: ServiceLine[];
}

export function ProfileCard({ profile, tasks, serviceLines }: ProfileCardProps) {
    const t = useTranslations('Auth');
    const zh = useLocale().startsWith('zh');
    const named = (names: { en: string; zh: string }) => (zh ? names.zh : names.en);
    const canOpen = new Set(tasks.map(task => task.code));

    // What is stored for a task the user can no longer open is not offered, and saving drops it.
    const [start, setStart] = useState(profile.start_task && canOpen.has(profile.start_task) ? profile.start_task : '');
    const [line, setLine] = useState(profile.service_line ?? '');
    const [home, setHome] = useState(profile.home_tasks.filter(code => canOpen.has(code)));
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const changed = <T,>(set: (value: T) => void) => (value: T) => {
        set(value);
        setSaved(false);
    };
    const toggleHome = (code: string) =>
        changed(setHome)(home.includes(code) ? home.filter(c => c !== code) : [...home, code]);

    const save = () => {
        setError(null);
        startTransition(async () => {
            const outcome = await saveAccountProfile(profile.account_oid, {
                start_task: start || null,
                home_tasks: home,
                service_line: line || null,
            });
            if ('error' in outcome) setError(outcome.error);
            else setSaved(true);
        });
    };

    const select = 'px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50';

    return (
        <section className="glass-card rounded-xl p-6 mt-6" data-testid="profile-customization">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">{t('profile.title')}</h3>
            <p className="mt-1 mb-4 text-sm text-gray-500">{t('profile.note')}</p>

            <h4 className="text-sm font-medium text-gray-300">{t('profile.canOpen', { count: tasks.length })}</h4>
            <p className="mt-1 mb-4 text-sm text-gray-500" data-testid="profile-can-open">
                {tasks.length ? tasks.map(task => named(task.name)).join(' · ') : t('profile.noTasks')}
            </p>

            <div className="flex flex-wrap gap-6 mb-4">
                <label className="flex flex-col gap-1 text-sm text-gray-300">
                    {t('profile.startPage')}
                    <select value={start} onChange={event => changed(setStart)(event.target.value)} className={select}>
                        <option value="">{t('profile.startNotSet')}</option>
                        {tasks.map(task => (
                            <option key={task.code} value={task.code}>
                                {named(task.area)} · {named(task.name)}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-300">
                    {t('profile.serviceLine')}
                    <select value={line} onChange={event => changed(setLine)(event.target.value)} className={select}>
                        <option value="">{t('profile.lineNotSet')}</option>
                        {serviceLines.map(serviceLine => (
                            <option key={serviceLine.code} value={serviceLine.code}>
                                {named(serviceLine.name)}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <fieldset className="mb-4">
                <legend className="text-sm font-medium text-gray-300">{t('profile.homeTasks')}</legend>
                <p className="mt-1 mb-2 text-sm text-gray-500">{t('profile.homeTasksNote')}</p>
                <div className="flex flex-wrap gap-2 max-h-56 overflow-auto">
                    {tasks.map(task => (
                        <label
                            key={task.code}
                            className="flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-sm text-gray-200 cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                checked={home.includes(task.code)}
                                onChange={() => toggleHome(task.code)}
                            />
                            {named(task.area)} · {named(task.name)}
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className="flex items-center gap-3">
                <button
                    onClick={save}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>{t('profile.save')}</span>
                </button>
                {saved && (
                    <span role="status" className="flex items-center gap-1 text-sm text-green-400">
                        <Check className="w-4 h-4" />
                        {t('profile.saved')}
                    </span>
                )}
                {error && <span role="alert" className="text-sm text-red-400">{error}</span>}
            </div>
        </section>
    );
}
