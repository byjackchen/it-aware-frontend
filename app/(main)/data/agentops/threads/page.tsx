/**
 * AgentOps Threads (thread messages) — Server Component.
 *
 * Flat, read-only view of ticket-conversation messages (human comments, agent
 * replies, system notes) across tickets. Fetched server-side, rendered by a
 * themed client table.
 */
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getThreadMessages } from '@/lib/api/objects';
import { ThreadsListPage } from './ThreadsListPage';

export default async function ThreadsPage() {
    const data = await getThreadMessages({ limit: 100 }).catch((error) => {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        return { items: [], total: 0, skip: 0, limit: 100 };
    });
    return <ThreadsListPage initial={data.items} total={data.total} />;
}
