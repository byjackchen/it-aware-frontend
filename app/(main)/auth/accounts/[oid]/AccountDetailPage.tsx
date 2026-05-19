'use client';

/**
 * Account detail page client component with edit, worker linking, and group assignment.
 */

import { useState, useTransition } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
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
    Cpu,
    UserCircle,
    Check,
    X,
    Sparkles,
    Copy,
    Eye,
    EyeOff,
} from 'lucide-react';

// Same generator as AccountCreatePage. Kept inline (4 lines) rather than
// extracting a util — the two callsites are stable and this avoids a new file.
function generateRandomPassword(length = 16): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+';
    const arr = new Uint32Array(length);
    crypto.getRandomValues(arr);
    return Array.from(arr, (n) => chars[n % chars.length]).join('');
}
import {
    AssignmentManager,
    WorkerSearchDialog,
    AgentSearchDialog,
    SystemSearchDialog,
} from '@/components/security';
import type { Account, Worker, Group } from '@/lib/types/security';
import type { Agent, System } from '@/lib/types/objects';
import {
    updateAccount,
    deleteAccount,
    linkAccountWorker,
    unlinkAccountWorker,
    linkAccountAgent,
    unlinkAccountAgent,
    linkAccountSystem,
    unlinkAccountSystem,
    assignAccountGroup,
    removeAccountGroup,
} from '@/app/actions/security';

interface AccountDetailPageProps {
    account: Account;
    linkedWorker: Worker | null;
    workers: Worker[];
    linkedWorkerOids: string[];
    linkedAgent: Agent | null;
    agents: Agent[];
    linkedAgentOids: string[];
    linkedSystem: System | null;
    systems: System[];
    linkedSystemOids: string[];
    assignedGroups: Group[];
    allGroups: Group[];
}

export function AccountDetailPage({
    account,
    linkedWorker,
    workers,
    linkedWorkerOids,
    linkedAgent,
    agents,
    linkedAgentOids,
    linkedSystem,
    systems,
    linkedSystemOids,
    assignedGroups,
    allGroups,
}: AccountDetailPageProps) {
    const t = useTranslations('Auth');
    const router = useTransitionRouter();
    const [isPending, startTransition] = useTransition();
    const [isEditing, setIsEditing] = useState(false);
    const [isLinkingWorker, setIsLinkingWorker] = useState(false);
    const [isLinkingAgent, setIsLinkingAgent] = useState(false);
    const [isLinkingSystem, setIsLinkingSystem] = useState(false);
    const [isActive, setIsActive] = useState(account.is_active);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleGenerate = () => {
        const pw = generateRandomPassword(16);
        setPassword(pw);
        setShowPassword(true);
        setCopied(false);
    };

    const handleCopy = async () => {
        if (!password) return;
        await navigator.clipboard.writeText(password);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

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
            router.push('/auth/accounts');
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
        if (!linkedWorker) return;
        startTransition(async () => {
            await unlinkAccountWorker(account.oid, linkedWorker.oid);
            router.refresh();
        });
    };

    // Agent handlers
    const handleLinkAgent = async (agent: Agent) => {
        startTransition(async () => {
            await linkAccountAgent(account.oid, agent.oid);
            setIsLinkingAgent(false);
            router.refresh();
        });
    };

    const handleUnlinkAgent = async () => {
        if (!linkedAgent) return;
        startTransition(async () => {
            await unlinkAccountAgent(account.oid, linkedAgent.oid);
            router.refresh();
        });
    };

    // System handlers
    const handleLinkSystem = async (system: System) => {
        startTransition(async () => {
            await linkAccountSystem(account.oid, system.oid);
            setIsLinkingSystem(false);
            router.refresh();
        });
    };

    const handleUnlinkSystem = async () => {
        if (!linkedSystem) return;
        startTransition(async () => {
            await unlinkAccountSystem(account.oid, linkedSystem.oid);
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
                            onClick={() => router.push('/auth/accounts')}
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
                                    {account.account_type === 'system' ? (
                                        <span className="flex items-center gap-1.5 text-purple-400">
                                            <Bot className="w-4 h-4" />
                                            <span>{t('accounts.typeSystem')}</span>
                                        </span>
                                    ) : account.account_type === 'agent' ? (
                                        <span className="flex items-center gap-1.5 text-blue-400">
                                            <Bot className="w-4 h-4" />
                                            <span>{t('accounts.typeAgent')}</span>
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5 text-green-400">
                                            <UserCircle className="w-4 h-4" />
                                            <span>{t('accounts.typeUser')}</span>
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

                        {/* Password reset (edit mode)
                            Optional here: blank = no change. Generate button
                            available for the same convenience as create. */}
                        {isEditing && (
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    {t('accounts.newPassword')}
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            setCopied(false);
                                        }}
                                        placeholder={t('accounts.passwordPlaceholderOptional')}
                                        className="flex-1 px-3 py-2 rounded-lg theme-input font-mono"
                                        minLength={8}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleGenerate}
                                        title={t('accounts.passwordGenerate')}
                                        className="px-3 py-2 rounded-lg theme-btn-neutral flex items-center gap-1"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        <span className="text-sm">{t('accounts.passwordGenerate')}</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((s) => !s)}
                                        title={showPassword ? t('accounts.passwordHide') : t('accounts.passwordShow')}
                                        className="px-3 py-2 rounded-lg theme-btn-neutral"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        disabled={!password}
                                        title={t('accounts.passwordCopy')}
                                        className="px-3 py-2 rounded-lg theme-btn-neutral disabled:opacity-50"
                                    >
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    {copied
                                        ? `✓ ${t('accounts.passwordCopied')}`
                                        : t('accounts.passwordHint')}
                                </p>
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

                    {/* Linked Worker (User accounts only) */}
                    {account.account_type === 'user' && (
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
                                            <div className="font-medium text-white">{linkedWorker.fullname}</div>
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

                    {/* Linked Agent (Agent accounts only) */}
                    {account.account_type === 'agent' && (
                        <div className="border-t pt-6 border-white/10">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                                Linked Agent
                            </h3>
                            {linkedAgent ? (
                                <div className="flex items-center justify-between p-3 rounded-lg theme-surface">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                                            <Bot className="w-5 h-5 text-purple-400" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">{linkedAgent.name}</div>
                                            <div className="text-sm text-gray-400">
                                                {linkedAgent.agent_id} · {linkedAgent.agent_platform}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleUnlinkAgent}
                                        disabled={isPending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors disabled:opacity-50"
                                    >
                                        <Unlink className="w-3.5 h-3.5" />
                                        <span>{t('accounts.unlink')}</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-3 rounded-lg theme-empty-bg">
                                    <span className="text-gray-500">No linked agent</span>
                                    <button
                                        onClick={() => setIsLinkingAgent(true)}
                                        disabled={isPending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-sm transition-colors disabled:opacity-50"
                                    >
                                        <Link className="w-3.5 h-3.5" />
                                        <span>Link Agent</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Linked System (System accounts only) */}
                    {account.account_type === 'system' && (
                        <div className="border-t pt-6 border-white/10">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                                Linked System
                            </h3>
                            {linkedSystem ? (
                                <div className="flex items-center justify-between p-3 rounded-lg theme-surface">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                                            <Cpu className="w-5 h-5 text-cyan-400" />
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">{linkedSystem.name}</div>
                                            <div className="text-sm text-gray-400">
                                                {linkedSystem.system_id} · {linkedSystem.system_platform}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={handleUnlinkSystem}
                                        disabled={isPending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors disabled:opacity-50"
                                    >
                                        <Unlink className="w-3.5 h-3.5" />
                                        <span>{t('accounts.unlink')}</span>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between p-3 rounded-lg theme-empty-bg">
                                    <span className="text-gray-500">No linked system</span>
                                    <button
                                        onClick={() => setIsLinkingSystem(true)}
                                        disabled={isPending}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm transition-colors disabled:opacity-50"
                                    >
                                        <Link className="w-3.5 h-3.5" />
                                        <span>Link System</span>
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

            {/* Agent Search Dialog */}
            <AgentSearchDialog
                isOpen={isLinkingAgent}
                onClose={() => setIsLinkingAgent(false)}
                onSelect={handleLinkAgent}
                agents={agents}
                linkedAgentOids={linkedAgentOids}
            />

            {/* System Search Dialog */}
            <SystemSearchDialog
                isOpen={isLinkingSystem}
                onClose={() => setIsLinkingSystem(false)}
                onSelect={handleLinkSystem}
                systems={systems}
                linkedSystemOids={linkedSystemOids}
            />
        </div>
    );
}
