/**
 * Location detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import {
    getLocation,
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

    try {
        const [location, edgesResponse, assignments, workers, roles] = await Promise.all([
            getLocation(oid),
            getConnectedEdges(oid),
            getWorkerHierarchyRoles(undefined, undefined, oid),
            getWorkers(true),
            getRoles(),
        ]);

        return (
            <LocationDetailPage
                location={location}
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
