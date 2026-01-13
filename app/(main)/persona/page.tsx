/**
 * Persona Profile Page - Server Component
 * 
 * Fetches worker data and builds a persona profile.
 * Shows the first worker by default; users can switch using the selector.
 */

import { getWorkers, getOrganizations, getLocations, getWorkerHardwares } from '@/lib/api/objects';
import { buildPersonaFromWorker } from '@/lib/types/persona';
import { PersonaProfilePage } from './PersonaProfilePage';

export default async function PersonaPage() {
    // Fetch data from existing APIs
    const [workers, organizations, locations] = await Promise.all([
        getWorkers(true), // Get active workers
        getOrganizations(),
        getLocations(),
    ]);

    // For default view: Use the first worker to build a persona
    const worker = workers[0];

    if (!worker) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-8">
                <div className="glass-card rounded-2xl p-12 text-center">
                    <h1 className="text-2xl font-semibold text-white mb-2">No Workers Found</h1>
                    <p className="text-gray-400">Add workers in the Data section to see persona profiles.</p>
                </div>
            </div>
        );
    }

    // Fetch hardware for this worker
    const hardwares = await getWorkerHardwares(worker.oid).catch(() => []);

    // Find related organization and location
    const organization = organizations.find(o => o.oid === worker.org_oid) || null;
    const location = worker.location_oid
        ? locations.find(l => l.oid === worker.location_oid) || null
        : null;

    // Build persona from worker data
    const persona = buildPersonaFromWorker(worker, organization, location, hardwares);

    return (
        <PersonaProfilePage
            persona={persona}
            workers={workers}
            currentWorkerOid={worker.oid}
        />
    );
}
