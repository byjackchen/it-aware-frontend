import { notFound } from 'next/navigation';
import {
    getConnectedEdges,
    getLocation,
    getOrganization,
    getWorker,
    getWorkerProfile,
} from '@/lib/api/objects';
import { PersonaProfilePage } from '../PersonaProfilePage';

interface PersonaWorkerPageProps {
    params: Promise<{ oid: string }>;
}

export default async function PersonaWorkerPage({ params }: PersonaWorkerPageProps) {
    const { oid } = await params;

    const worker = await getWorker(oid).catch(() => null);
    if (!worker) {
        notFound();
    }

    const [workerProfile, organization, location, edgesResponse] = await Promise.all([
        getWorkerProfile(worker.oid).catch(() => null),
        getOrganization(worker.org_oid).catch(() => null),
        worker.location_oid ? getLocation(worker.location_oid).catch(() => null) : Promise.resolve(null),
        getConnectedEdges(worker.oid).catch(() => ({ items: [], total: 0, page: 1, page_size: 100 })),
    ]);

    return (
        <PersonaProfilePage
            currentWorker={worker}
            workerProfile={workerProfile}
            organization={organization}
            location={location}
            edges={edgesResponse.items}
        />
    );
}
