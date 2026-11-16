/**
 * Worker creation page - Server Component.
 */

import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getOrganizations } from '@/lib/api/objects';
import { WorkerCreatePage } from './WorkerCreatePage';

export default async function NewWorkerPage() {
    // Load every organization (not one 1000-row page) so nodes created after
    // the bulk of the tree, such as "External / HQ", can be selected.
    let organizations: Awaited<ReturnType<typeof getOrganizations>>;
    try {
        organizations = await getOrganizations();
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        throw error;
    }
    return <WorkerCreatePage organizations={organizations} />;
}
