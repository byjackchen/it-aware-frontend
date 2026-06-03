/**
 * Accounts page - Server Component.
 */

import {
    getAccounts,
    getAccountWorkers,
    getAccountAgents,
    getAccountSystems,
} from '@/lib/api/security';
import { getWorkers, getAgents, getSystems } from '@/lib/api/objects';
import { AccountsListPage } from './AccountsListPage';

export default async function AccountsPage() {
    const [
        accounts,
        workers,
        agents,
        systems,
        accountWorkers,
        accountAgents,
        accountSystems,
    ] = await Promise.all([
        getAccounts(),
        getWorkers(),
        getAgents(),
        getSystems(),
        getAccountWorkers(),
        getAccountAgents(),
        getAccountSystems(),
    ]);

    return (
        <AccountsListPage
            accounts={accounts}
            workers={workers}
            agents={agents}
            systems={systems}
            accountWorkers={accountWorkers}
            accountAgents={accountAgents}
            accountSystems={accountSystems}
        />
    );
}
