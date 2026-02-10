/**
 * Individual Worker Persona Page - Server Component
 * 
 * Fetches a specific worker's data and builds their persona profile.
 */

import { notFound } from 'next/navigation';
import { getWorker, getOrganization, getLocation, getWorkerHardwares } from '@/lib/api/objects';
import { buildPersonaFromWorker } from '@/lib/types/persona';
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
