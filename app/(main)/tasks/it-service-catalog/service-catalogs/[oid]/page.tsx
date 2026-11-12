/**
 * Service Catalog detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import {
    getServiceCatalog,
    getServiceCatalogs,
    getConnectedEdges,
    getWorkerHierarchyRoles,
    getWorkers,
    getRoles,
} from '@/lib/api/objects';
import { ServiceCatalogDetailPage } from './ServiceCatalogDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function ServiceCatalogPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [serviceCatalog, serviceCatalogs, edgesResponse, assignments, workers, roles] = await Promise.all([
            getServiceCatalog(oid),
            getServiceCatalogs(),
            getConnectedEdges(oid),
            getWorkerHierarchyRoles(undefined, undefined, oid),
            getWorkers(true),
            getRoles(),
        ]);

        return (
            <ServiceCatalogDetailPage
                serviceCatalog={serviceCatalog}
                serviceCatalogs={serviceCatalogs}
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
