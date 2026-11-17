/**
 * The tasks a user can open, from their groups. What is on their home is set on
 * each group (Maintain Access → group); the user's own pins are kept apart.
 */

import { useLocale, useTranslations } from 'next-intl';
import { named } from '@/lib/tasks/catalog';
import type { Task } from '@/lib/types/tasks';

export interface ProfileCardProps {
    /** The tasks this user can open now. */
    tasks: Task[];
}

export function ProfileCard({ tasks }: ProfileCardProps) {
    const t = useTranslations('Auth');
    const locale = useLocale();

    return (
        <section className="glass-card rounded-xl p-6 mt-6" data-testid="profile-customization">
            <h4 className="text-sm font-medium text-ink-2">{t('profile.canOpen', { count: tasks.length })}</h4>
            <p className="mt-1 text-sm text-muted" data-testid="profile-can-open">
                {tasks.length ? tasks.map(task => named(task.name, locale)).join(' · ') : t('profile.noTasks')}
            </p>
            <p className="mt-4 text-sm text-muted">{t('profile.homeByGroup')}</p>
        </section>
    );
}
