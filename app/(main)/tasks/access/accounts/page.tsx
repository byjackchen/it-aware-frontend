/**
 * Accounts page - Server Component.
 */

import {
    getAccounts,
    getAccountWorkers,
    getAccountSystems,
} from '@/lib/api/security';
import { getWorkers, getSystems } from '@/lib/api/objects';
import { AccountsListPage } from './AccountsListPage';

export default async function AccountsPage() {
    const [
        accounts,
        workers,
        systems,
        accountWorkers,
        accountSystems,
    ] = await Promise.all([
        getAccounts(),
        getWorkers(),
        getSystems(),
        getAccountWorkers(),
        getAccountSystems(),
    ]);

    return (
        <AccountsListPage
            accounts={accounts}
            workers={workers}
            systems={systems}
            accountWorkers={accountWorkers}
            accountSystems={accountSystems}
        />
    );
}
