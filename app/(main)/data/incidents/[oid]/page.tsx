/**
 * Incident detail page - Server Component.
 */

import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import {
    getIncident,
    getIncidentSlas,
    getConnectedEdges,
    getOrganizations,
    getWorkers,
    getServiceCatalogs,
} from '@/lib/api/objects';
import { IncidentDetailPage } from './IncidentDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function IncidentPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [incident, edgesResponse, organizations, workers, serviceCatalogs, slasResponse] = await Promise.all([
            getIncident(oid),
            getConnectedEdges(oid),
            getOrganizations(),
            getWorkers(),
            getServiceCatalogs(),
            // SLAs fetch is non-fatal: if the endpoint errors (e.g. migration
            // 0085 not yet applied, or transient 5xx), surface an empty list
            // instead of 404ing the whole detail page.
            getIncidentSlas(oid).catch(() => ({ items: [], total: 0 })),
        ]);

        return (
            <IncidentDetailPage
                incident={incident}
                edges={edgesResponse.items}
                organizations={organizations}
                workers={workers}
                serviceCatalogs={serviceCatalogs}
                slas={slasResponse.items}
            />
        );
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }
}
