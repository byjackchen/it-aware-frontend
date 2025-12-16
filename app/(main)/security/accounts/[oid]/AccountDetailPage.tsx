'use client';

/**
 * Account detail page client component with edit, worker linking, and group assignment.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowLeft,
    Trash2,
    Pencil,
    Loader2,
    User,
    Save,
    Link,
    Unlink,
    Bot,
    UserCircle,
    Check,
    X,
} from 'lucide-react';
import { AssignmentManager, WorkerSearchDialog } from '@/components/security';
import type { Account, Worker, Group } from '@/lib/types/security';
import {
    updateAccount,
    deleteAccount,
    linkAccountWorker,
    unlinkAccountWorker,
    assignAccountGroup,
    removeAccountGroup,
} from '../../actions';

interface AccountDetailPageProps {
    account: Account;
    linkedWorker: Worker | null;
    workers: Worker[];
    linkedWorkerOids: string[];
    assignedGroups: Group[];
    allGroups: Group[];
}

export function AccountDetailPage({
    account,
    linkedWorker,
    workers,
    linkedWorkerOids,
    assignedGroups,
    allGroups,
}: AccountDetailPageProps) {
    const t = useTranslations('Security');
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isEditing, setIsEditing] = useState(false);
    const [isLinkingWorker, setIsLinkingWorker] = useState(false);
    const [isActive, setIsActive] = useState(account.is_active);
    const [password, setPassword] = useState('');

    const handleSave = () => {
        const formData = new FormData();
        formData.set('is_active', String(isActive));
        if (password) {
            formData.set('password', password);
        }
        startTransition(async () => {
            await updateAccount(account.oid, formData);
            setIsEditing(false);
            setPassword('');
            router.refresh();
        });
    };

    const handleDelete = () => {
        if (!confirm(t('common.deleteConfirm'))) return;
        startTransition(async () => {
            await deleteAccount(account.oid);
            router.push('/security/accounts');
        });
    };

    const handleCancel = () => {
        setIsActive(account.is_active);
        setPassword('');
        setIsEditing(false);
    };

    // Worker handlers
    const handleLinkWorker = async (worker: Worker) => {
        startTransition(async () => {
            await linkAccountWorker(account.oid, worker.oid);
            setIsLinkingWorker(false);
            router.refresh();
        });
    };

    const handleUnlinkWorker = async () => {
        startTransition(async () => {
            await unlinkAccountWorker(account.oid);
            router.refresh();
        });
    };

    // Group handlers
    const handleAssignGroup = async (groupOid: string) => {
        await assignAccountGroup(account.oid, groupOid);
        router.refresh();
    };

    const handleRemoveGroup = async (groupOid: string) => {
        await removeAccountGroup(account.oid, groupOid);
        router.refresh();
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/security/accounts')}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </button>
                        <div className="flex items-center gap-3">
                            <User className="w-6 h-6 text-blue-400" />
                            <h1 className="text-2xl font-semibold text-white">{t('accounts.detail')}</h1>
                        </div>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                        >
                            <Pencil className="w-4 h-4" />
                            <span>{t('common.edit')}</span>
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="glass-card rounded-xl p-6 space-y-6">
                    {/* Account Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                {t('accounts.username')}
                            </label>
                            <div className="px-3 py-2 rounded-lg theme-input-readonly text-white text-lg">
                                {account.username}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    {t('accounts.type')}
                                </label>
                                <div className="px-3 py-2 rounded-lg theme-input-readonly">
                                    {account.is_system ? (
                                        <span className="flex items-center gap-1.5 text-purple-400">
                                            <Bot className="w-4 h-4" />
                                            <span>{t('accounts.typeSystem')}</span>
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-blue-400">
                                            <UserCircle className="w-4 h-4" />
                                            <span>{t('accounts.typeRegular')}</span>
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    {t('accounts.status')}
                                </label>
                                {isEditing ? (
                                    <label className="flex items-center gap-3 px-3 py-2">
                                        <input
                                            type="checkbox"
                                            checked={isActive}
                                            onChange={(e) => setIsActive(e.target.checked)}
                                            className="w-5 h-5 rounded theme-checkbox"
                                        />
                                        <span className="text-white">{t('common.active')}</span>
                                    </label>
                                ) : (
                                    <div className="px-3 py-2 rounded-lg theme-input-readonly">
                                        {account.is_active ? (
                                            <span className="flex items-center gap-1 text-green-400">
                                                <Check className="w-4 h-4" />
                                                <span>{t('common.active')}</span>
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-red-400">
                                                <X className="w-4 h-4" />
                                                <span>{t('common.inactive')}</span>
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Password (System accounts only, edit mode) */}
                        {isEditing && account.is_system && (
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    {t('accounts.newPassword')}
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('accounts.passwordPlaceholderOptional')}
                                    className="w-full px-3 py-2 rounded-lg theme-input"
                                    minLength={8}
                                />
                                <p className="text-xs text-gray-500 mt-1">{t('accounts.passwordHint')}</p>
                            </div>
                        )}
                    </div>

                    {/* Edit Actions */}
                    {isEditing && (
                        <div className="flex gap-3">
                            <button
                                onClick={handleSave}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                            >
                                {isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                <span>{t('common.save')}</span>
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={isPending}
                                className="px-4 py-2 rounded-lg theme-btn-neutral"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    )}

                    {/* Linked Worker (Non-system accounts only) */}
                    {!account.is_system && (
                        <div className="border-t pt-6 border-white/10">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                                {t('accounts.linkedWorker')}
                            </h3>
                            {linkedWorker ? (
                                <div className="flex items-center justify-between p-3 rounded-lg theme-surface">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            <User className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">{linkedWorker.full_name}</div>
                                            <div className="text-sm text-gray-400">
                                                {linkedWorker.email || linkedWorker.worker_id || t('accounts.noEmail')}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleUnlinkWorker}
                                        disabled={isPending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors disabled:opacity-50"
                                    >
                                        <Unlink className="w-3.5 h-3.5" />
                                        <span>{t('accounts.unlink')}</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-3 rounded-lg theme-empty-bg">
                                    <span className="text-gray-500">{t('accounts.noLinkedWorker')}</span>
                                    <button
                                        onClick={() => setIsLinkingWorker(true)}
                                        disabled={isPending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm transition-colors disabled:opacity-50"
                                    >
                                        <Link className="w-3.5 h-3.5" />
                                        <span>{t('accounts.linkWorker')}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Group Assignments */}
                    <AssignmentManager
                        title={t('groups.title')}
                        assigned={assignedGroups}
                        available={allGroups}
                        getId={(g) => g.oid}
                        getLabel={(g) => g.name}
                        onAssign={handleAssignGroup}
                        onRemove={handleRemoveGroup}
                    />

                    {/* Delete Action */}
                    {!isEditing && (
                        <div className="pt-4 border-t border-white/10">
                            <button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                            >
                                {isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                <span>{t('common.delete')}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Worker Search Dialog */}
            <WorkerSearchDialog
                isOpen={isLinkingWorker}
                onClose={() => setIsLinkingWorker(false)}
                onSelect={handleLinkWorker}
                workers={workers}
                linkedWorkerOids={linkedWorkerOids}
            />
        </div>
    );
}
