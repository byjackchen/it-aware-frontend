/**
 * Tickets list page - Server Component.
 */

import { getTickets, getOrganizations, getWorkers } from '@/lib/api/objects';
import { TicketsListPage } from './TicketsListPage';

export default async function TicketsPage() {
    const [tickets, organizations, workers] = await Promise.all([
        getTickets(),
        getOrganizations(),
        getWorkers(),
    ]);

    return <TicketsListPage tickets={tickets} organizations={organizations} workers={workers} />;
}
