/**
 * Accounts page - Server Component.
 */

import { getAccounts, getWorkers, getAccountWorkers } from '@/lib/api/security';
import { AccountsListPage } from './AccountsListPage';

export default async function AccountsPage() {
    const [accounts, workers, accountWorkers] = await Promise.all([
        getAccounts(),
        getWorkers(true),
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
