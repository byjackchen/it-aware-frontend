'use client';

/**
 * The tasks an admin puts on the home of every member of a group. A member
 * sees only those they can open; their own pins are kept apart.
 */

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Check, Loader2, Save } from 'lucide-react';
import { saveGroupHomeTasks } from '@/app/actions/tasks';
import { groupingName, named } from '@/lib/tasks/catalog';
import type { Task } from '@/lib/types/tasks';

export interface HomeTasksCardProps {
    groupOid: string;
    /** The codes set now, in order. */
    homeTasks: string[];
    /** Every task of the catalog. */
    tasks: Task[];
}

export function HomeTasksCard({ groupOid, homeTasks, tasks }: HomeTasksCardProps) {
    const t = useTranslations('Auth');
    const locale = useLocale();
    const label = (task: Task) => `${groupingName(task.grouping, locale)} · ${named(task.name, locale)}`;

    const [home, setHome] = useState(homeTasks);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const toggle = (code: string) => {
        setHome(home.includes(code) ? home.filter(c => c !== code) : [...home, code]);
        setSaved(false);
    };

    const save = () => {
        setError(null);
        startTransition(async () => {
            const outcome = await saveGroupHomeTasks(groupOid, home);
            if ('error' in outcome) setError(outcome.error);
            else setSaved(true);
        });
    };

    return (
        <section className="glass-card rounded-xl p-6 mt-6" data-testid="group-home-tasks">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-2">{t('groupHome.title')}</h3>
            <p className="mt-1 mb-4 text-sm text-muted">{t('groupHome.note')}</p>

            <fieldset className="mb-4">
                <legend className="sr-only">{t('groupHome.title')}</legend>
                <div className="flex flex-wrap gap-2 max-h-56 overflow-auto">
                    {tasks.map(task => (
                        <label
                            key={task.code}
                            className="flex items-center gap-2 px-3 py-1 rounded-full border border-line bg-field text-sm text-ink cursor-pointer"
                        >
                            <input type="checkbox" checked={home.includes(task.code)} onChange={() => toggle(task.code)} />
                            {label(task)}
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
                    <span>{t('groupHome.save')}</span>
                </button>
                {saved && (
                    <span role="status" className="flex items-center gap-1 text-sm text-good">
                        <Check className="w-4 h-4" />
                        {t('groupHome.saved')}
                    </span>
                )}
                {error && <span role="alert" className="text-sm text-bad">{error}</span>}
            </div>
        </section>
    );
}
