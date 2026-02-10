/**
 * Persona Profile Page - Server Component
 * 
 * Fetches worker data and builds a persona profile.
 * Shows the first worker by default; users can switch using the selector.
 */

import { getWorkersPage, getOrganization, getLocation, getWorkerHardwares } from '@/lib/api/objects';
import { buildPersonaFromWorker } from '@/lib/types/persona';
import { PersonaProfilePage } from './PersonaProfilePage';

export default async function PersonaPage() {
    // Fetch only the first active worker for first paint.
    const workers = await getWorkersPage({ isActive: true, limit: 1 });
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

    const [hardwares, organization, location] = await Promise.all([
        getWorkerHardwares(worker.oid).catch(() => []),
        getOrganization(worker.org_oid).catch(() => null),
        worker.location_oid ? getLocation(worker.location_oid).catch(() => null) : Promise.resolve(null),
    ]);

    // Build persona from worker data
    const persona = buildPersonaFromWorker(worker, organization, location, hardwares);

    return (
        <PersonaProfilePage
            persona={persona}
            currentWorker={worker}
        />
    );
}
