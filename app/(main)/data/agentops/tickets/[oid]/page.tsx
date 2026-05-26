/**
 * Ticket detail page - Server Component.
 */

import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getTicket, getTicketsPage } from '@/lib/api/objects';
import { getAccounts } from '@/lib/api/security';
import { TicketDetailPage } from './TicketDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function TicketPage({ params }: PageProps) {
    const { oid } = await params;
    const [ticket, accounts, ticketsResp] = await Promise.all([
        getTicket(oid),
        getAccounts(),
        getTicketsPage({ limit: 1000 }), // for the parent-ticket picker
    ]).catch((error) => {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    });

    return <TicketDetailPage ticket={ticket} accounts={accounts} allTickets={ticketsResp.items} />;
}
