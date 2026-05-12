'use client';

/**
 * Agent detail page client component.
 */

import { useEffect, useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import {
    ArrowLeft,
    Bot,
    Pencil,
    Save,
    Trash2,
    Loader2,
    X,
    Link2,
    Link2Off,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import type { Agent, Worker } from '@/lib/types/objects';
import type { AccountAgent } from '@/lib/types/security';
import {
    updateAgentAction,
    deleteAgentAction,
    linkAccountAgentAction,
    unlinkAccountAgentAction,
} from '@/app/actions/objects';

interface AgentDetailPageProps {
    agent: Agent;
    workers: Worker[];
}

export function AgentDetailPage({ agent, workers }: AgentDetailPageProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useTransitionRouter();
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const [name, setName] = useState(agent.name);
    const [agentKey, setAgentKey] = useState(agent.agent_key || '');
    const [agentAdminKey, setAgentAdminKey] = useState(agent.agent_admin_key || '');
    const [workspaceId, setWorkspaceId] = useState(agent.agent_workspace_id || '');
    const [agentPlatform, setAgentPlatform] = useState(agent.agent_platform);
    const [contactWorkerOid, setContactWorkerOid] = useState(agent.contact_worker_oid);
    const [description, setDescription] = useState(agent.description || '');
    const [isActive, setIsActive] = useState(agent.is_active);

    // Linked account (via auth.account_agent)
    const [linkedAccount, setLinkedAccount] = useState<AccountAgent | null>(null);
    const [pendingAccountOid, setPendingAccountOid] = useState('');
    const [linkPending, setLinkPending] = useState(false);
    const [linkError, setLinkError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetch(`/api/auth/config/account_agents?agent_oid=${agent.oid}`)
            .then((r) => (r.ok ? r.json() : []))
            .then((items: AccountAgent[]) => {
                if (!cancelled) setLinkedAccount(items[0] ?? null);
            })
            .catch(() => {
                if (!cancelled) setLinkedAccount(null);
            });
        return () => {
            cancelled = true;
        };
    }, [agent.oid]);

    const handleLink = async () => {
        if (!pendingAccountOid.trim()) return;
        setLinkPending(true);
        setLinkError(null);
        try {
            await linkAccountAgentAction(pendingAccountOid.trim(), agent.oid);
            const fresh = await fetch(`/api/auth/config/account_agents?agent_oid=${agent.oid}`)
                .then((r) => (r.ok ? r.json() : []));
            setLinkedAccount((fresh as AccountAgent[])[0] ?? null);
            setPendingAccountOid('');
        } catch (err) {
            setLinkError(err instanceof Error ? err.message : 'Link failed');
        } finally {
            setLinkPending(false);
        }
    };

    const handleUnlink = async () => {
        if (!linkedAccount) return;
        setLinkPending(true);
        setLinkError(null);
        try {
            await unlinkAccountAgentAction(linkedAccount.account_oid, agent.oid);
            setLinkedAccount(null);
        } catch (err) {
            setLinkError(err instanceof Error ? err.message : 'Unlink failed');
        } finally {
            setLinkPending(false);
        }
    };

    const contactWorker = workers.find((w) => w.oid === agent.contact_worker_oid);
    const contactWorkerDisplay = contactWorker
        ? `${contactWorker.fullname} (${contactWorker.stable_id})`
        : agent.contact_worker_oid;

    const inputClass = `w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`;
    const labelClass = `block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`;
    const valueClass = `text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`;

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            if (name) formData.set('name', name);
            if (agentKey.trim()) formData.set('agent_key', agentKey.trim());
            if (agentAdminKey.trim()) formData.set('agent_admin_key', agentAdminKey.trim());
            if (workspaceId.trim()) formData.set('agent_workspace_id', workspaceId.trim());
            if (agentPlatform) formData.set('agent_platform', agentPlatform);
            if (contactWorkerOid) formData.set('contact_worker_oid', contactWorkerOid);
            if (description.trim()) formData.set('description', description.trim());
            formData.set('is_active', String(isActive));

            await updateAgentAction(agent.oid, formData);
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error('Failed to update agent:', error);
            alert(error instanceof Error ? error.message : 'Failed to update agent');
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this agent?')) return;
        setIsPending(true);
        try {
            await deleteAgentAction(agent.oid);
            router.push('/data/agents');
        } catch (error) {
            console.error('Failed to delete agent:', error);
            alert(error instanceof Error ? error.message : 'Failed to delete agent');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setName(agent.name);
        setAgentKey(agent.agent_key || '');
        setAgentAdminKey(agent.agent_admin_key || '');
        setWorkspaceId(agent.agent_workspace_id || '');
        setAgentPlatform(agent.agent_platform);
        setContactWorkerOid(agent.contact_worker_oid);
        setDescription(agent.description || '');
        setIsActive(agent.is_active);
        setIsEditing(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Page Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/data/agents')}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                        >
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}`}>
                                <Bot className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Agent Details</h1>
                                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {agent.agent_id}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isEditing ? (
                            <>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                                >
                                    <Pencil className="w-4 h-4" />
                                    <span>Edit</span>
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={isPending}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                    <span>Delete</span>
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleSave}
                                    disabled={isPending}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors disabled:opacity-50"
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    <span>Save</span>
                                </button>
                                <button
                                    onClick={handleCancel}
                                    disabled={isPending}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                                >
                                    <X className="w-4 h-4" />
                                    <span>Cancel</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>

                    {/* Name + Agent ID */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Name</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className={inputClass}
                                />
                            ) : (
                                <div className={`text-xl font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{agent.name}</div>
                            )}
                        </div>
                        <div>
                            <label className={labelClass}>Agent ID (readonly)</label>
                            <div className={`px-3 py-2 rounded-lg font-mono text-sm ${isLight ? 'bg-slate-50 text-slate-700 border border-slate-200' : 'bg-white/5 text-gray-300 border border-white/10'}`}>
                                {agent.agent_id}
                            </div>
                        </div>
                    </div>

                    {/* Platform + Active */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Platform</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={agentPlatform}
                                    onChange={(e) => setAgentPlatform(e.target.value)}
                                    className={inputClass}
                                    placeholder="e.g. openai, anthropic"
                                />
                            ) : (
                                <div className={valueClass}>{agent.agent_platform}</div>
                            )}
                        </div>
                        <div>
                            <label className={labelClass}>Active</label>
                            {isEditing ? (
                                <select
                                    value={String(isActive)}
                                    onChange={(e) => setIsActive(e.target.value === 'true')}
                                    className={inputClass}
                                >
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                </select>
                            ) : (
                                <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${agent.is_active
                                    ? (isLight ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400')
                                    : (isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-400')
                                }`}>
                                    {agent.is_active ? 'Active' : 'Inactive'}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Contact Worker */}
                    <div>
                        <label className={labelClass}>Contact Worker</label>
                        {isEditing ? (
                            <select
                                value={contactWorkerOid}
                                onChange={(e) => setContactWorkerOid(e.target.value)}
                                className={inputClass}
                            >
                                <option value="">Select worker...</option>
                                {workers.map((worker) => (
                                    <option key={worker.oid} value={worker.oid}>
                                        {worker.fullname} ({worker.stable_id})
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <div className={valueClass}>{contactWorkerDisplay}</div>
                        )}
                    </div>

                    {/* Agent Key */}
                    <div>
                        <label className={labelClass}>Agent Key</label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={agentKey}
                                onChange={(e) => setAgentKey(e.target.value)}
                                className={inputClass}
                                placeholder="API key for agent execution"
                            />
                        ) : (
                            <div className={valueClass}>{agent.agent_key || '—'}</div>
                        )}
                    </div>

                    {/* Agent Admin Key */}
                    <div>
                        <label className={labelClass}>Agent Admin Key</label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={agentAdminKey}
                                onChange={(e) => setAgentAdminKey(e.target.value)}
                                className={inputClass}
                                placeholder="Admin API key (e.g. for pulling conversation histories)"
                            />
                        ) : (
                            <div className={valueClass}>{agent.agent_admin_key || '—'}</div>
                        )}
                    </div>

                    {/* Workspace ID */}
                    <div>
                        <label className={labelClass}>Workspace ID</label>
                        <input
                            type="text"
                            value={workspaceId}
                            onChange={(e) => setWorkspaceId(e.target.value)}
                            className={inputClass}
                            disabled={!isEditing}
                        />
                    </div>

                    {/* Linked Account (via auth.account_agent) */}
                    <div className={`p-4 rounded-lg border ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/5'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Link2 className="w-4 h-4" />
                            <span className={labelClass}>Linked Account</span>
                        </div>
                        {linkedAccount ? (
                            <div className="flex items-center justify-between gap-3">
                                <code className={`font-mono text-xs break-all ${valueClass}`}>{linkedAccount.account_oid}</code>
                                <button
                                    type="button"
                                    onClick={handleUnlink}
                                    disabled={linkPending}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
                                >
                                    {linkPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2Off className="w-3 h-3" />}
                                    <span>Unlink</span>
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={pendingAccountOid}
                                    onChange={(e) => setPendingAccountOid(e.target.value)}
                                    placeholder="account oid"
                                    className={inputClass}
                                />
                                <button
                                    type="button"
                                    onClick={handleLink}
                                    disabled={linkPending || !pendingAccountOid.trim()}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50"
                                >
                                    {linkPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                                    <span>Link</span>
                                </button>
                            </div>
                        )}
                        {linkError && <div className="mt-2 text-xs text-red-400">{linkError}</div>}
                    </div>

                    {/* Description */}
                    <div>
                        <label className={labelClass}>Description</label>
                        {isEditing ? (
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className={inputClass}
                            />
                        ) : (
                            <div className={`p-4 rounded-lg whitespace-pre-wrap ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                                {agent.description || <span className="italic opacity-50">No description provided</span>}
                            </div>
                        )}
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-dashed border-white/10">
                        <div>
                            <label className={labelClass}>Created At</label>
                            <div className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{agent.created_at}</div>
                        </div>
                        <div>
                            <label className={labelClass}>Updated At</label>
                            <div className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>{agent.updated_at}</div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
