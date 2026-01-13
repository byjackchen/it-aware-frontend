/**
 * Accounts page - Server Component.
 */

import { getAccounts, getAccountWorkers } from '@/lib/api/security';
import { getWorkers } from '@/lib/api/objects';
import { AccountsListPage } from './AccountsListPage';

export default async function AccountsPage() {
    const [accounts, workers, accountWorkers] = await Promise.all([
        getAccounts(),
        getWorkers(), // Fetch all workers to display linked worker names
        getAccountWorkers(),
    ]);

    return (
        <AccountsListPage
            accounts={accounts}
            workers={workers}
            accountWorkers={accountWorkers}
        />
    );
}
