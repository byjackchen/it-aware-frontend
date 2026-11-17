/**
 * Worker detail page - Server Component.
 */

import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getWorker, getConnectedEdges, getOrganizations, getLocations } from '@/lib/api/objects';
import { WorkerDetailPage } from './WorkerDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function WorkerPage({ params }: PageProps) {
    const { oid: id } = await params;

    // Resolve worker first (id may be an OID or stable_id)
    let worker: Awaited<ReturnType<typeof getWorker>>;
    try {
        worker = await getWorker(id);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }

    // Use resolved OID for APIs that require it (edges) and for consistency
    const workerOid = worker.oid;

    const [edgesResponse, organizations, locations] = await (async () => {
        try {
            return await Promise.all([
                getConnectedEdges(workerOid),
                getOrganizations(),
                getLocations(),
            ]);
        } catch (error) {
            if (error instanceof ApiError && error.status === 403) {
                redirect('/access-denied');
            }
            notFound();
        }
    })();
    return (
        <WorkerDetailPage
            worker={worker}
            edges={edgesResponse.items}
            organizations={organizations}
            locations={locations}
        />
    );
}
