/**
 * AgentOps Runs — Server Component.
 *
 * A Run is one execution of an agent against a ticket (or ad-hoc payload).
 * Read-only: the list is fetched server-side and rendered by a themed client
 * table. No create/edit.
 */
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getRuns } from '@/lib/api/objects';
import { RunsListPage } from './RunsListPage';

export default async function RunsPage() {
    const data = await getRuns({ limit: 100 }).catch((error) => {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        return { items: [], total: 0, skip: 0, limit: 100 };
    });
    return <RunsListPage initial={data.items} total={data.total} />;
}
