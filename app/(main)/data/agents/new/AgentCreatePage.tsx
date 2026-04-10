'use client';

/**
 * Agent creation page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bot, Loader2, Save } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useLazyResourceList } from '@/lib/hooks/useLazyResourceList';
import type { Worker } from '@/lib/types/objects';
import { createAgentAction } from '@/app/actions/objects';

export function AgentCreatePage() {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Required fields
    const [name, setName] = useState('');
    const [agentId, setAgentId] = useState('');
    const [agentPlatform, setAgentPlatform] = useState('');
    const [contactWorkerOid, setContactWorkerOid] = useState('');

    // Optional fields
    const [agentKey, setAgentKey] = useState('');
    const [accountOid, setAccountOid] = useState('');
    const [description, setDescription] = useState('');
    const [workspaceId, setWorkspaceId] = useState('');

    const {
        items: workers,
        isLoading: isWorkersLoading,
        error: workersError,
    } = useLazyResourceList<Worker>('workers', {
        query: { limit: 1000 },
        auto: true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!name.trim() || !agentId.trim() || !agentPlatform.trim() || !contactWorkerOid) {
            setError('Please fill in all required fields (Name, Agent ID, Platform, Contact Worker).');
            return;
        }

        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('name', name.trim());
            formData.set('agent_id', agentId.trim());
            formData.set('agent_platform', agentPlatform.trim());
            formData.set('contact_worker_oid', contactWorkerOid);

            if (agentKey.trim()) formData.set('agent_key', agentKey.trim());
            if (workspaceId.trim()) formData.set('agent_workspace_id', workspaceId.trim());
            if (accountOid.trim()) formData.set('account_oid', accountOid.trim());
            if (description.trim()) formData.set('description', description.trim());

            await createAgentAction(formData);
            router.push('/data/agents');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create agent.');
        } finally {
            setIsPending(false);
        }
    };

    const inputClass = `w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`;
    const labelClass = `block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`;

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-3xl mx-auto space-y-6">
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
                        <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>New Agent</h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Required fields */}
                    <div className="space-y-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Required</h3>

                        <div>
                            <label className={labelClass}>Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={inputClass}
                                placeholder="e.g. Onboarding Helper"
                                required
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Agent ID *</label>
                            <input
                                type="text"
                                value={agentId}
                                onChange={(e) => setAgentId(e.target.value)}
                                className={inputClass}
                                placeholder="e.g. agent-001"
                                required
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Platform *</label>
                            <input
                                type="text"
                                value={agentPlatform}
                                onChange={(e) => setAgentPlatform(e.target.value)}
                                className={inputClass}
                                placeholder="e.g. openai, anthropic, custom"
                                required
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Contact Worker *</label>
                            <select
                                value={contactWorkerOid}
                                onChange={(e) => setContactWorkerOid(e.target.value)}
                                className={inputClass}
                                disabled={isWorkersLoading || !!workersError}
                                required
                            >
                                <option value="">
                                    {isWorkersLoading
                                        ? 'Loading workers...'
                                        : workersError
                                            ? 'Failed to load workers'
                                            : 'Select contact worker...'}
                                </option>
                                {workers.map((worker) => (
                                    <option key={worker.oid} value={worker.oid}>
                                        {worker.fullname} ({worker.stable_id})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Optional fields */}
                    <div className="space-y-4 pt-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Optional</h3>

                        <div>
                            <label className={labelClass}>Agent Key</label>
                            <input
                                type="text"
                                value={agentKey}
                                onChange={(e) => setAgentKey(e.target.value)}
                                className={inputClass}
                                placeholder="API key or identifier"
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Workspace ID</label>
                            <input
                                type="text"
                                value={workspaceId}
                                onChange={(e) => setWorkspaceId(e.target.value)}
                                className={inputClass}
                                placeholder="e.g. f6c90bea-1078-408c-86ac-2090633ed5d3"
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Account OID</label>
                            <input
                                type="text"
                                value={accountOid}
                                onChange={(e) => setAccountOid(e.target.value)}
                                className={inputClass}
                                placeholder="Associated account OID"
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                className={inputClass}
                                placeholder="What does this agent do?"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white disabled:opacity-50"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Create Agent</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/data/agents')}
                            disabled={isPending}
                            className={`px-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
