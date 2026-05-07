import { getAccounts } from '@/lib/api/security';
import { TicketCreatePage } from './TicketCreatePage';

export default async function NewTicketPage() {
    const accounts = await getAccounts();
    return <TicketCreatePage accounts={accounts} />;
}
