/**
 * Account detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import {
    getAccount,
    getGroups,
    getAccountWorkers,
    getAccountAgents,
    getAccountSystems,
    getAccountGroups,
} from '@/lib/api/security';
import { getWorkers, getAgents, getSystems } from '@/lib/api/objects';
import type {
    AccountWorker,
    AccountAgent,
    AccountSystem,
    AccountGroup,
    Worker,
    Group,
} from '@/lib/types/security';
import type { Agent, System } from '@/lib/types/objects';
import { AccountDetailPage } from './AccountDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function AccountPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [
            account,
            workers,
            agents,
            systems,
            groups,
            accountWorkers,
            accountAgents,
            accountSystems,
            accountGroups,
        ] = await Promise.all([
            getAccount(oid),
            getWorkers(),
            getAgents(),
            getSystems(),
            getGroups(),
            getAccountWorkers(oid),
            getAccountAgents({ account_oid: oid }),
            getAccountSystems({ account_oid: oid }),
            getAccountGroups(oid),
        ]);

        // Linked entity for this account, based on type
        const workerLink = accountWorkers.find((aw: AccountWorker) => aw.account_oid === oid);
        const linkedWorker = workerLink
            ? workers.find((w: Worker) => w.oid === workerLink.worker_oid) || null
            : null;

        const agentLink = accountAgents.find((aa: AccountAgent) => aa.account_oid === oid);
        const linkedAgent = agentLink
            ? agents.find((a: Agent) => a.oid === agentLink.agent_oid) || null
            : null;

        const systemLink = accountSystems.find((as: AccountSystem) => as.account_oid === oid);
        const linkedSystem = systemLink
            ? systems.find((s: System) => s.oid === systemLink.system_oid) || null
            : null;

        // OIDs of already-linked entities (to filter the search dialogs)
        const [allAccountWorkers, allAccountAgents, allAccountSystems] = await Promise.all([
            getAccountWorkers(),
            getAccountAgents(),
            getAccountSystems(),
        ]);
        const linkedWorkerOids = allAccountWorkers.map((aw: AccountWorker) => aw.worker_oid);
        const linkedAgentOids = allAccountAgents.map((aa: AccountAgent) => aa.agent_oid);
        const linkedSystemOids = allAccountSystems.map((as: AccountSystem) => as.system_oid);

        // Assigned groups
        const assignedGroupOids = accountGroups.map((ag: AccountGroup) => ag.group_oid);
        const assignedGroups = groups.filter((g: Group) => assignedGroupOids.includes(g.oid));

        return (
            <AccountDetailPage
                account={account}
                linkedWorker={linkedWorker}
                workers={workers}
                linkedWorkerOids={linkedWorkerOids}
                linkedAgent={linkedAgent}
                agents={agents}
                linkedAgentOids={linkedAgentOids}
                linkedSystem={linkedSystem}
                systems={systems}
                linkedSystemOids={linkedSystemOids}
                assignedGroups={assignedGroups}
                allGroups={groups}
            />
        );
    } catch {
        notFound();
    }
}
