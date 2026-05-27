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
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import type { Agent, Worker, PromptListItem } from '@/lib/types/objects';
import {
    updateAgentAction,
    deleteAgentAction,
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
    const [agentId, setAgentId] = useState(agent.agent_id);
    const [agentKey, setAgentKey] = useState(agent.agent_key || '');
    const [agentAdminKey, setAgentAdminKey] = useState(agent.agent_admin_key || '');
    const [agentPlatform, setAgentPlatform] = useState(agent.agent_platform);
    const [contactWorkerOid, setContactWorkerOid] = useState(agent.contact_worker_oid);
    const [description, setDescription] = useState(agent.description || '');
    const [isActive, setIsActive] = useState(agent.is_active);
    const [promptOids, setPromptOids] = useState<string[]>(agent.prompt_oids || []);
    const [promptOptions, setPromptOptions] = useState<PromptListItem[]>([]);

    useEffect(() => {
        fetch('/api/agentops/prompts?limit=200&is_active=true')
            .then((r) => (r.ok ? r.json() : { items: [] }))
            .then((d) => setPromptOptions(d.items || []))
            .catch(() => setPromptOptions([]));
    }, []);

    const togglePrompt = (oid: string) =>
        setPromptOids((cur) => (cur.includes(oid) ? cur.filter((o) => o !== oid) : [...cur, oid]));

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
            if (agentId && agentId.trim()) formData.set('agent_id', agentId.trim());
            if (agentKey.trim()) formData.set('agent_key', agentKey.trim());
            if (agentAdminKey.trim()) formData.set('agent_admin_key', agentAdminKey.trim());
            if (agentPlatform) formData.set('agent_platform', agentPlatform);
            if (contactWorkerOid) formData.set('contact_worker_oid', contactWorkerOid);
            if (description.trim()) formData.set('description', description.trim());
            formData.set('is_active', String(isActive));
            formData.set('prompt_oids', JSON.stringify(promptOids));

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
        setAgentId(agent.agent_id);
        setAgentKey(agent.agent_key || '');
        setAgentAdminKey(agent.agent_admin_key || '');
        setAgentPlatform(agent.agent_platform);
        setContactWorkerOid(agent.contact_worker_oid);
        setDescription(agent.description || '');
        setIsActive(agent.is_active);
        setPromptOids(agent.prompt_oids || []);
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
                            <label className={labelClass}>Agent ID</label>
                            {isEditing ? (
                                <>
                                    <input
                                        type="text"
                                        value={agentId}
                                        onChange={(e) => setAgentId(e.target.value)}
                                        className={`${inputClass} font-mono`}
                                    />
                                    <p className={`text-xs mt-1 ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                                        ⚠ Changing agent_id breaks external references (Knot, tickets) and seed.py upserts. Only edit if you understand the impact.
                                    </p>
                                </>
                            ) : (
                                <div className={`px-3 py-2 rounded-lg font-mono text-sm ${isLight ? 'bg-slate-50 text-slate-700 border border-slate-200' : 'bg-white/5 text-gray-300 border border-white/10'}`}>
                                    {agent.agent_id}
                                </div>
                            )}
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

                    {/* Prompts (role injection) */}
                    <div>
                        <label className={labelClass}>Prompts (injected as the agent&apos;s role preamble)</label>
                        {isEditing ? (
                            <div className={`rounded-lg p-2 max-h-56 overflow-y-auto space-y-1 ${isLight ? 'bg-slate-50 border border-slate-200' : 'bg-white/5 border border-white/10'}`}>
                                {promptOptions.length === 0 && (
                                    <div className="text-xs text-[var(--text-secondary)] px-2 py-1">No active prompts. Create some under Data → Prompts.</div>
                                )}
                                {promptOptions.map((p) => (
                                    <label key={p.oid} className="flex items-center gap-2 px-2 py-1 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={promptOids.includes(p.oid)}
                                            onChange={() => togglePrompt(p.oid)}
                                            data-testid={`agent-prompt-${p.oid}`}
                                        />
                                        <span className="font-medium">{p.display_name || p.name}</span>
                                        <span className="text-[11px] text-[var(--text-secondary)]">{p.kind} · v{p.version}</span>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-1.5">
                                {(agent.prompt_oids || []).length === 0 ? (
                                    <span className={`text-sm italic opacity-50 ${valueClass}`}>No prompts attached</span>
                                ) : (
                                    (agent.prompt_oids || []).map((oid) => {
                                        const p = promptOptions.find((x) => x.oid === oid);
                                        return (
                                            <span key={oid} className="text-xs px-2 py-1 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/20">
                                                {p ? (p.display_name || p.name) : `${oid.slice(0, 8)}…`}
                                            </span>
                                        );
                                    })
                                )}
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
