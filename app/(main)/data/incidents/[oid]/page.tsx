/**
 * Incident detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getIncident, getConnectedEdges, getOrganizations, getWorkers } from '@/lib/api/objects';
import { IncidentDetailPage } from './IncidentDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function IncidentPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [incident, edgesResponse, organizations, workers] = await Promise.all([
            getIncident(oid),
            getConnectedEdges(oid),
            getOrganizations(),
            getWorkers(),
        ]);

        return (
            <IncidentDetailPage
                incident={incident}
                edges={edgesResponse.items}
                organizations={organizations}
                workers={workers}
            />
        );
    } catch {
        notFound();
    }
}
