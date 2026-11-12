import { notFound } from 'next/navigation';
import {
    getConnectedEdges,
    getLocation,
    getOrganization,
    getWorker,
    getWorkerProfile,
} from '@/lib/api/objects';
import { getWorkerCluster, getClusterSummary } from '@/lib/api/clusters';
import { PersonaProfilePage } from '../PersonaProfilePage';

interface PersonaWorkerPageProps {
    params: Promise<{ oid: string }>;
}

export default async function PersonaWorkerPage({ params }: PersonaWorkerPageProps) {
    const { oid: id } = await params;

    // id may be an OID or stable_id
    const worker = await getWorker(id).catch(() => null);
    if (!worker) {
        notFound();
    }

    const workerOid = worker.oid;
    const [workerProfile, organization, location, edgesResponse, workerCluster, clusterSummary] = await Promise.all([
        getWorkerProfile(workerOid).catch(() => null),
        getOrganization(worker.org_oid).catch(() => null),
        worker.location_oid ? getLocation(worker.location_oid).catch(() => null) : Promise.resolve(null),
        getConnectedEdges(workerOid).catch(() => ({ items: [], total: 0, page: 1, page_size: 100 })),
        getWorkerCluster(workerOid).catch(() => null),
        getClusterSummary().catch(() => null),
    ]);

    return (
        <PersonaProfilePage
            currentWorker={worker}
            workerProfile={workerProfile}
            organization={organization}
            location={location}
            edges={edgesResponse.items}
            workerCluster={workerCluster}
            clusterSummary={clusterSummary}
        />
    );
}
