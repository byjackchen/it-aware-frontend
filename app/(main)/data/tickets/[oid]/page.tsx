/**
 * Ticket detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getTicket, getConnectedEdges, getOrganizations, getWorkers } from '@/lib/api/objects';
import { TicketDetailPage } from './TicketDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function TicketPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [ticket, edgesResponse, organizations, workers] = await Promise.all([
            getTicket(oid),
            getConnectedEdges(oid),
            getOrganizations(),
            getWorkers(),
        ]);

        return (
            <TicketDetailPage
                ticket={ticket}
                edges={edgesResponse.items}
                organizations={organizations}
                workers={workers}
            />
        );
    } catch {
        notFound();
    }
}
