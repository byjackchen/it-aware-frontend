/**
 * Organization detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import {
    getOrganization,
    getOrganizations,
    getConnectedEdges,
    getWorkerHierarchyRoles,
    getWorkers,
    getRoles,
} from '@/lib/api/objects';
import { OrganizationDetailPage } from './OrganizationDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function OrganizationPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [organization, organizations, edgesResponse, assignments, workers, roles] = await Promise.all([
            getOrganization(oid),
            getOrganizations(),
            getConnectedEdges(oid),
            getWorkerHierarchyRoles(undefined, undefined, oid),
            getWorkers(true),
            getRoles(),
        ]);

        return (
            <OrganizationDetailPage
                organization={organization}
                organizations={organizations}
                edges={edgesResponse.items}
                assignments={assignments}
                workers={workers}
                roles={roles}
            />
        );
    } catch {
        notFound();
    }
}

