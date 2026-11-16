/**
 * Task access page - Server Component. Who has what tasks, by group and by
 * person.
 */

import { getTaskAccess } from '@/lib/api/tasks';
import { TaskAccessPage } from './TaskAccessPage';

export default async function TasksPage() {
    return <TaskAccessPage access={await getTaskAccess()} />;
}
