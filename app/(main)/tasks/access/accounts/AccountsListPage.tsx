'use client';

/**
 * Accounts list page with navigation to detail and create pages.
 */

import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import { Plus, User, Check, X } from 'lucide-react';
import type {
    Account,
    Worker,
    AccountWorker,
    AccountSystem,
} from '@/lib/types/security';
import { canLinkSystem, isIntegrationAccount } from '@/lib/types/security';
import type { System } from '@/lib/types/objects';

interface AccountsListPageProps {
    accounts: Account[];
    workers: Worker[];
    systems: System[];
    accountWorkers: AccountWorker[];
    accountSystems: AccountSystem[];
}

export function AccountsListPage({
    accounts,
    workers,
    systems,
    accountWorkers,
    accountSystems,
}: AccountsListPageProps) {
    const t = useTranslations('Auth');
    const router = useTransitionRouter();

    // For a given account, return a display label for its linked entity
    // (a worker for a user, a system record for an integration account), or
    // null if unlinked.
    const getLinkedLabel = (account: Account): string | null => {
        if (account.account_type === 'user') {
            const link = accountWorkers.find((aw) => aw.account_oid === account.oid);
            if (!link) return null;
            const w = workers.find((x) => x.oid === link.worker_oid);
            return w ? w.fullname : null;
        }
        if (canLinkSystem(account.account_type)) {
            const link = accountSystems.find((as) => as.account_oid === account.oid);
            if (!link) return null;
            const s = systems.find((x) => x.oid === link.system_oid);
            return s ? s.name : null;
        }
        return null;
    };

    const handleRowClick = (account: Account) => {
        router.push(`/tasks/access/accounts/${account.oid}`);
    };

    const handleCreateClick = () => {
        router.push('/tasks/access/accounts/new');
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="h-full glass-card rounded-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-line flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-accent" />
                        <h1 className="text-xl font-semibold text-ink">{t('accounts.title')}</h1>
                    </div>
                    <button
                        onClick={handleCreateClick}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-btn-accent hover:bg-btn-accent-hover text-accent transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">{t('common.create')}</span>
                    </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {accounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted">
                            <User className="w-12 h-12 mb-4 opacity-50" />
                            <p>{t('accounts.empty')}</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="sticky top-0 bg-inherit">
                                <tr className="text-left text-sm text-ink-2 border-b border-line">
                                    <th className="px-4 py-3 font-medium">{t('accounts.username')}</th>
                                    <th className="px-4 py-3 font-medium">{t('accounts.type')}</th>
                                    <th className="px-4 py-3 font-medium">{t('accounts.status')}</th>
                                    <th className="px-4 py-3 font-medium">Linked</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {accounts.map((account) => {
                                    const linkedLabel = getLinkedLabel(account);
                                    return (
                                        <tr
                                            key={account.oid}
                                            onClick={() => handleRowClick(account)}
                                            className="hover:bg-hover cursor-pointer transition-colors"
                                        >
                                            <td className="px-4 py-3">
                                                <span className="font-medium text-ink">{account.username}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                    isIntegrationAccount(account.account_type) ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                                    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                }`}>
                                                    {isIntegrationAccount(account.account_type) ? t('accounts.typeIntegration') : t('accounts.typeUser')}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {account.is_active ? (
                                                    <span className="flex items-center gap-1 text-good">
                                                        <Check className="w-4 h-4" />
                                                        <span className="text-sm">{t('common.active')}</span>
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-ink-2">
                                                        <X className="w-4 h-4" />
                                                        <span className="text-sm">{t('common.inactive')}</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {linkedLabel ? (
                                                    <span className="text-ink">{linkedLabel}</span>
                                                ) : (
                                                    <span className="text-muted">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
