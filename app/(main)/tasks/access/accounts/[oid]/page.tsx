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
import { getAccountProfile, getTaskAccess } from '@/lib/api/tasks';
import type {
    AccountWorker,
    AccountSystem,
    AccountGroup,
    Worker,
    Group,
} from '@/lib/types/security';
import type { System } from '@/lib/types/objects';
import { AccountDetailPage } from './AccountDetailPage';
import type { ProfileCardProps } from './ProfileCard';

/**
 * The customization part of a user's profile, with the tasks the user can
 * open. Null for an integration account, while the backend's profile switch is off, or for
 * an admin who may not read who has what tasks: the page then shows what it
 * showed before.
 */
async function loadCustomization(oid: string, accountType: string): Promise<ProfileCardProps | null> {
    if (accountType !== 'user') return null;
    const [profile, access] = await Promise.all([
        getAccountProfile(oid).catch(() => null),
        getTaskAccess().catch(() => null),
    ]);
    const held = access?.accounts.find(candidate => candidate.oid === oid);
    if (!profile || !access || !held) return null;
    const codes = new Set(held.tasks.map(task => task.code));
    return {
        profile,
        tasks: access.tasks.filter(task => codes.has(task.code)),
    };
}

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
        customization: await loadCustomization(oid, account.account_type),
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
