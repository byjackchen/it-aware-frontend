/**
 * Incident detail page - Server Component.
 */

import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getIncident, getConnectedEdges, getOrganizations, getWorkers, getServiceCatalogs } from '@/lib/api/objects';
import { IncidentDetailPage } from './IncidentDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function IncidentPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [incident, edgesResponse, organizations, workers, serviceCatalogs] = await Promise.all([
            getIncident(oid),
            getConnectedEdges(oid),
            getOrganizations(),
            getWorkers(),
            getServiceCatalogs(),
        ]);

        return (
            <IncidentDetailPage
                incident={incident}
                edges={edgesResponse.items}
                organizations={organizations}
                workers={workers}
                serviceCatalogs={serviceCatalogs}
            />
        );
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }
}
