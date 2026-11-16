/**
 * Request detail page - Server Component.
 */

import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getRequest, getConnectedEdges, getWorkers, getServiceCatalogs } from '@/lib/api/objects';
import { RequestDetailPage } from './RequestDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function RequestPage({ params }: PageProps) {
    const { oid } = await params;
    const [request, edgesResponse, workers, serviceCatalogs] = await Promise.all([
        getRequest(oid),
        getConnectedEdges(oid),
        getWorkers(),
        getServiceCatalogs(),
    ]).catch((error) => {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    });

    return (
        <RequestDetailPage
            request={request}
            edges={edgesResponse.items}
            workers={workers}
            serviceCatalogs={serviceCatalogs}
        />
    );
}
