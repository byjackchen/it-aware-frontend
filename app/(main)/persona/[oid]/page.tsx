/**
 * Individual Worker Persona Page - Server Component
 * 
 * Fetches a specific worker's data and builds their persona profile.
 */

import { notFound } from 'next/navigation';
import { getWorker, getWorkers, getOrganizations, getLocations, getWorkerHardwares } from '@/lib/api/objects';
import { buildPersonaFromWorker } from '@/lib/types/persona';
import { PersonaProfilePage } from '../PersonaProfilePage';

interface PersonaWorkerPageProps {
    params: Promise<{ oid: string }>;
}

export default async function PersonaWorkerPage({ params }: PersonaWorkerPageProps) {
    const { oid } = await params;

    // Fetch data from existing APIs
    const [worker, workers, organizations, locations] = await Promise.all([
        getWorker(oid).catch(() => null),
        getWorkers(true), // Get active workers for the selector
        getOrganizations(),
        getLocations(),
    ]);

    if (!worker) {
        notFound();
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
            currentWorkerOid={oid}
        />
    );
}
