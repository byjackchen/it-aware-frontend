/**
 * Worker detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getWorker, getConnectedEdges, getOrganizations, getLocations } from '@/lib/api/objects';
import { WorkerDetailPage } from './WorkerDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function WorkerPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [worker, edgesResponse, organizations, locations] = await Promise.all([
            getWorker(oid),
            getConnectedEdges(oid),
            getOrganizations(),
            getLocations(),
        ]);

        return (
            <WorkerDetailPage
                worker={worker}
                edges={edgesResponse.items}
                organizations={organizations}
                locations={locations}
            />
        );
    } catch {
        notFound();
    }
}

