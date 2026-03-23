import {
    getConnectedEdges,
    getLocation,
    getOrganization,
    getWorkerProfile,
    getWorkersPage,
} from '@/lib/api/objects';
import { getWorkerCluster, getClusterSummary } from '@/lib/api/clusters';
import { PersonaProfilePage } from './PersonaProfilePage';

export default async function PersonaPage() {
    const workers = await getWorkersPage({ isActive: true, limit: 1 });
    const worker = workers[0];

    if (!worker) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-8">
                <div className="glass-card rounded-2xl p-12 text-center">
                    <h1 className="text-2xl font-semibold text-white mb-2">No Workers Found</h1>
                    <p className="text-gray-400">Add workers in the Data section to view persona pages.</p>
                </div>
            </div>
        );
    }

    const [workerProfile, organization, location, edgesResponse, workerCluster, clusterSummary] = await Promise.all([
        getWorkerProfile(worker.oid).catch(() => null),
        getOrganization(worker.org_oid).catch(() => null),
        worker.location_oid ? getLocation(worker.location_oid).catch(() => null) : Promise.resolve(null),
        getConnectedEdges(worker.oid).catch(() => ({ items: [], total: 0, page: 1, page_size: 100 })),
        getWorkerCluster(worker.oid).catch(() => null),
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
