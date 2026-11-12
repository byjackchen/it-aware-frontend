/**
 * Location detail page - Server Component.
 */

import type { ComponentProps } from 'react';
import { notFound } from 'next/navigation';
import {
    getLocation,
    getLocations,
    getConnectedEdges,
    getWorkerHierarchyRoles,
    getWorkers,
    getRoles,
} from '@/lib/api/objects';
import { LocationDetailPage } from './LocationDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function LocationPage({ params }: PageProps) {
    const { oid } = await params;

    // Built outside the try: React renders after this returns, so a try cannot catch its errors.
    let props: ComponentProps<typeof LocationDetailPage>;
    try {
        const [location, locations, edgesResponse, assignments, workers, roles] = await Promise.all([
            getLocation(oid),
            getLocations(),
            getConnectedEdges(oid),
            getWorkerHierarchyRoles(undefined, undefined, oid),
            getWorkers(true),
            getRoles(),
        ]);

        props = { location, locations, edges: edgesResponse.items, assignments, workers, roles };
    } catch {
        notFound();
    }

    return <LocationDetailPage {...props} />;
}

