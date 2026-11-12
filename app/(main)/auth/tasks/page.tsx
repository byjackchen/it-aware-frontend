/**
 * Task access page - Server Component. Who has what tasks, by group and by
 * person. Reached by address; not in the menu. Not found while the backend's
 * tasks switch is off.
 */

import { notFound } from 'next/navigation';
import { getTaskAccess } from '@/lib/api/tasks';
import { TaskAccessPage } from './TaskAccessPage';

export default async function TasksPage() {
    const access = await getTaskAccess();
    if (!access) {
        notFound();
    }
    return <TaskAccessPage access={access} />;
}
