/**
 * Account detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import {
    getAccount,
    getWorkers,
    getGroups,
    getAccountWorkers,
    getAccountGroups,
} from '@/lib/api/security';
import { AccountDetailPage } from './AccountDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function AccountPage({ params }: PageProps) {
    const { oid } = await params;

    try {
        const [account, workers, groups, accountWorkers, accountGroups] = await Promise.all([
            getAccount(oid),
            getWorkers(true),
            getGroups(),
            getAccountWorkers(oid),
            getAccountGroups(oid),
        ]);

        // Get linked worker
        const workerLink = accountWorkers.find((aw) => aw.account_oid === oid);
        const linkedWorker = workerLink
            ? workers.find((w) => w.oid === workerLink.worker_oid) || null
            : null;

        // Get all linked worker OIDs for filtering
        const allAccountWorkers = await getAccountWorkers();
        const linkedWorkerOids = allAccountWorkers.map((aw) => aw.worker_oid);

        // Get assigned groups
        const assignedGroupOids = accountGroups.map((ag) => ag.group_oid);
        const assignedGroups = groups.filter((g) => assignedGroupOids.includes(g.oid));

        return (
            <AccountDetailPage
                account={account}
                linkedWorker={linkedWorker}
                workers={workers}
                linkedWorkerOids={linkedWorkerOids}
                assignedGroups={assignedGroups}
                allGroups={groups}
            />
        );
    } catch {
        notFound();
    }
}
