/**
 * Ticket detail page - Server Component.
 */

import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getTicket, getTicketsPage, getAgents } from '@/lib/api/objects';
import { getAccounts } from '@/lib/api/security';
import { TicketDetailPage } from './TicketDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function TicketPage({ params }: PageProps) {
    const { oid } = await params;
    const [ticket, accounts, ticketsResp, agents] = await Promise.all([
        getTicket(oid),
        getAccounts(),
        getTicketsPage({ limit: 1000 }), // for the parent-ticket picker
        getAgents().catch(() => []),     // agent_oid → name, for agent_reply attribution
    ]).catch((error) => {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    });

    return <TicketDetailPage ticket={ticket} accounts={accounts} allTickets={ticketsResp.items} agents={agents} />;
}
