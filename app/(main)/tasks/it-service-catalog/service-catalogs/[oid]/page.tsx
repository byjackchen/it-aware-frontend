/**
 * Service Catalog detail page - Server Component.
 */

import type { ComponentProps } from 'react';
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

    // Built outside the try: React renders after this returns, so a try cannot catch its errors.
    let props: ComponentProps<typeof ServiceCatalogDetailPage>;
    try {
        const [serviceCatalog, serviceCatalogs, edgesResponse, assignments, workers, roles] = await Promise.all([
            getServiceCatalog(oid),
            getServiceCatalogs(),
            getConnectedEdges(oid),
            getWorkerHierarchyRoles(undefined, undefined, oid),
            getWorkers(true),
            getRoles(),
        ]);

        props = { serviceCatalog, serviceCatalogs, edges: edgesResponse.items, assignments, workers, roles };
    } catch {
        notFound();
    }

    return <ServiceCatalogDetailPage {...props} />;
}
