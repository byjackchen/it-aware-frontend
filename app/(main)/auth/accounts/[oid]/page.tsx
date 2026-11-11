/**
 * Account detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import {
    getAccount,
    getGroups,
    getAccountWorkers,
    getAccountSystems,
    getAccountGroups,
} from '@/lib/api/security';
import { getWorkers, getSystems } from '@/lib/api/objects';
import type {
    AccountWorker,
    AccountSystem,
    AccountGroup,
    Worker,
    Group,
} from '@/lib/types/security';
import type { System } from '@/lib/types/objects';
import { AccountDetailPage } from './AccountDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

async function loadAccount(oid: string) {
    const [
        account,
        workers,
        systems,
        groups,
        accountWorkers,
        accountSystems,
        accountGroups,
    ] = await Promise.all([
        getAccount(oid),
        getWorkers(),
        getSystems(),
        getGroups(),
        getAccountWorkers(oid),
        getAccountSystems({ account_oid: oid }),
        getAccountGroups(oid),
    ]);

    // Linked entity for this account, based on type
    const workerLink = accountWorkers.find((aw: AccountWorker) => aw.account_oid === oid);
    const linkedWorker = workerLink
        ? workers.find((w: Worker) => w.oid === workerLink.worker_oid) || null
        : null;

    const systemLink = accountSystems.find((as: AccountSystem) => as.account_oid === oid);
    const linkedSystem = systemLink
        ? systems.find((s: System) => s.oid === systemLink.system_oid) || null
        : null;

    // OIDs of already-linked entities (to filter the search dialogs)
    const [allAccountWorkers, allAccountSystems] = await Promise.all([
        getAccountWorkers(),
        getAccountSystems(),
    ]);
    const linkedWorkerOids = allAccountWorkers.map((aw: AccountWorker) => aw.worker_oid);
    const linkedSystemOids = allAccountSystems.map((as: AccountSystem) => as.system_oid);

    // Assigned groups
    const assignedGroupOids = accountGroups.map((ag: AccountGroup) => ag.group_oid);
    const assignedGroups = groups.filter((g: Group) => assignedGroupOids.includes(g.oid));

    return {
        account,
        linkedWorker,
        workers,
        linkedWorkerOids,
        linkedSystem,
        systems,
        linkedSystemOids,
        assignedGroups,
        allGroups: groups,
    };
}

export default async function AccountPage({ params }: PageProps) {
    const { oid } = await params;
    let data: Awaited<ReturnType<typeof loadAccount>>;
    try {
        data = await loadAccount(oid);
    } catch {
        notFound();
    }
    return <AccountDetailPage {...data} />;
}
