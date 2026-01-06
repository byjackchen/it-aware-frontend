/**
 * Worker creation page - Server Component.
 */

import { getOrganizations, getLocations, getWorkers } from '@/lib/api/objects';
import { WorkerCreatePage } from './WorkerCreatePage';

export default async function NewWorkerPage() {
    const [organizations, locations, workers] = await Promise.all([
        getOrganizations(),
        getLocations(),
        getWorkers(),
    ]);

    return (
        <WorkerCreatePage
            organizations={organizations}
            locations={locations}
            workers={workers}
        />
    );
}
