/**
 * Organization detail page - Server Component.
 */

import type { ComponentProps } from 'react';
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

    // Built outside the try: React renders after this returns, so a try cannot catch its errors.
    let props: ComponentProps<typeof OrganizationDetailPage>;
    try {
        const [organization, organizations, edgesResponse, assignments, workers, roles] = await Promise.all([
            getOrganization(oid),
            getOrganizations(),
            getConnectedEdges(oid),
            getWorkerHierarchyRoles(undefined, undefined, oid),
            getWorkers(true),
            getRoles(),
        ]);

        props = { organization, organizations, edges: edgesResponse.items, assignments, workers, roles };
    } catch {
        notFound();
    }

    return <OrganizationDetailPage {...props} />;
}

