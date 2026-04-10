/**
 * Ticket detail page - Server Component.
 */

import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getTicket } from '@/lib/api/objects';
import { TicketDetailPage } from './TicketDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function TicketPage({ params }: PageProps) {
    const { oid } = await params;
    const ticket = await getTicket(oid).catch((error) => {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    });

    return <TicketDetailPage ticket={ticket} />;
}
