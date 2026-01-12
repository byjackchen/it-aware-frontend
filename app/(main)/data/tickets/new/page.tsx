/**
 * Ticket creation page - Server Component.
 */

import { getWorkers } from '@/lib/api/objects';
import { NewTicketPage } from './NewTicketPage';

export default async function Page() {
    const workers = await getWorkers(true); // Only active workers

    return (
        <NewTicketPage workers={workers} />
    );
}
