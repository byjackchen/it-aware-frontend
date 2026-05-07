'use client';

/**
 * Accounts list page with navigation to detail and create pages.
 */

import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import { Plus, User, Check, X } from 'lucide-react';
import type { Account, Worker, AccountWorker } from '@/lib/types/security';

interface AccountsListPageProps {
    accounts: Account[];
    workers: Worker[];
    accountWorkers: AccountWorker[];
}

export function AccountsListPage({
    accounts,
    workers,
    accountWorkers,
}: AccountsListPageProps) {
    const t = useTranslations('Auth');
    const router = useTransitionRouter();

    const getLinkedWorker = (accountOid: string): Worker | null => {
        const link = accountWorkers.find((aw) => aw.account_oid === accountOid);
        if (!link) return null;
        return workers.find((w) => w.oid === link.worker_oid) || null;
    };

    const handleRowClick = (account: Account) => {
        router.push(`/auth/accounts/${account.oid}`);
    };

    const handleCreateClick = () => {
        router.push('/auth/accounts/new');
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="h-full glass-card rounded-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-blue-400" />
                        <h1 className="text-xl font-semibold text-white">{t('accounts.title')}</h1>
                    </div>
                    <button
                        onClick={handleCreateClick}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">{t('common.create')}</span>
                    </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {accounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <User className="w-12 h-12 mb-4 opacity-50" />
                            <p>{t('accounts.empty')}</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="sticky top-0 bg-inherit">
                                <tr className="text-left text-sm text-gray-400 border-b border-white/10">
                                    <th className="px-4 py-3 font-medium">{t('accounts.username')}</th>
                                    <th className="px-4 py-3 font-medium">{t('accounts.type')}</th>
                                    <th className="px-4 py-3 font-medium">{t('accounts.status')}</th>
                                    <th className="px-4 py-3 font-medium">{t('accounts.linkedWorker')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {accounts.map((account) => {
                                    const worker = getLinkedWorker(account.oid);
                                    return (
                                        <tr
                                            key={account.oid}
                                            onClick={() => handleRowClick(account)}
                                            className="hover:bg-white/5 cursor-pointer transition-colors"
                                        >
                                            <td className="px-4 py-3">
                                                <span className="font-medium text-white">{account.username}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                                    account.account_type === 'system' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                                                    account.account_type === 'agent' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                                                    'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                                }`}>
                                                    {account.account_type === 'system' ? 'System' : account.account_type === 'agent' ? 'Agent' : 'User'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {account.is_active ? (
                                                    <span className="flex items-center gap-1 text-green-400">
                                                        <Check className="w-4 h-4" />
                                                        <span className="text-sm">{t('common.active')}</span>
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-gray-400">
                                                        <X className="w-4 h-4" />
                                                        <span className="text-sm">{t('common.inactive')}</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                {worker ? (
                                                    <span className="text-white">{worker.fullname}</span>
                                                ) : (
                                                    <span className="text-gray-500">—</span>
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
