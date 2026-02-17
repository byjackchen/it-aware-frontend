/**
 * Worker detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getWorker, getWorkerProfile, getConnectedEdges, getOrganizations, getLocations, getWorkerHardwares } from '@/lib/api/objects';
import { WorkerDetailPage } from './WorkerDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function WorkerPage({ params }: PageProps) {
    const { oid } = await params;
    const [worker, edgesResponse, organizations, locations, hardwares] = await (async () => {
        try {
            return await Promise.all([
                getWorker(oid),
                getConnectedEdges(oid),
                getOrganizations(),
                getLocations(),
                getWorkerHardwares(oid),
            ]);
        } catch {
            notFound();
        }
    })();
    let workerProfile = null;
    try {
        workerProfile = await getWorkerProfile(oid);
    } catch (error) {
        if (typeof error === 'object' && error !== null && 'digest' in error) {
            const digest = (error as { digest?: unknown }).digest;
            if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
                throw error;
            }
        }
        console.warn(`Failed to fetch worker profile for oid=${oid}; rendering without profile`, error);
    }

    return (
        <WorkerDetailPage
            worker={worker}
            edges={edgesResponse.items}
            organizations={organizations}
            locations={locations}
            hardwares={hardwares}
            workerProfile={workerProfile}
        />
    );
}
