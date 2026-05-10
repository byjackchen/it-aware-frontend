'use client';

/**
 * System creation page client component.
 *
 * Mirrors AgentCreatePage with two key differences:
 *   - contact_worker_oid is OPTIONAL (infrastructure systems can be ownerless)
 *   - no agent_key / admin_key / workspace_id fields
 */

import { useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { ArrowLeft, Cpu, Loader2, Save } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useLazyResourceList } from '@/lib/hooks/useLazyResourceList';
import type { Worker } from '@/lib/types/objects';
import { createSystemAction } from '@/app/actions/objects';

export function SystemCreatePage() {
    const { theme } = useTheme();
    const router = useTransitionRouter();
    const isLight = theme === 'light';
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState('');
    const [systemId, setSystemId] = useState('');
    const [systemPlatform, setSystemPlatform] = useState('');
    const [contactWorkerOid, setContactWorkerOid] = useState('');
    const [accountOid, setAccountOid] = useState('');
    const [description, setDescription] = useState('');

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

        if (!name.trim() || !systemId.trim() || !systemPlatform.trim()) {
            setError('Please fill in all required fields (Name, System ID, Platform).');
            return;
        }

        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('name', name.trim());
            formData.set('system_id', systemId.trim());
            formData.set('system_platform', systemPlatform.trim());
            if (contactWorkerOid) formData.set('contact_worker_oid', contactWorkerOid);
            if (accountOid.trim()) formData.set('account_oid', accountOid.trim());
            if (description.trim()) formData.set('description', description.trim());

            await createSystemAction(formData);
            router.push('/data/systems');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create system.');
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
                        onClick={() => router.push('/data/systems')}
                        className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                    >
                        <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-cyan-100 text-cyan-600' : 'bg-cyan-500/20 text-cyan-400'}`}>
                            <Cpu className="w-5 h-5" />
                        </div>
                        <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>New System</h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm" role="alert">
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
                                placeholder="e.g. ServiceNow Ingestion"
                                required
                            />
                        </div>

                        <div>
                            <label className={labelClass}>System ID *</label>
                            <input
                                type="text"
                                value={systemId}
                                onChange={(e) => setSystemId(e.target.value)}
                                className={inputClass}
                                placeholder="e.g. servicenow-ingest"
                                required
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Platform *</label>
                            <input
                                type="text"
                                value={systemPlatform}
                                onChange={(e) => setSystemPlatform(e.target.value)}
                                className={inputClass}
                                placeholder="e.g. ingestion, scheduler, internal"
                                required
                            />
                        </div>
                    </div>

                    {/* Optional fields */}
                    <div className="space-y-4 pt-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Optional</h3>

                        <div>
                            <label className={labelClass}>Contact Worker</label>
                            <select
                                value={contactWorkerOid}
                                onChange={(e) => setContactWorkerOid(e.target.value)}
                                className={inputClass}
                                disabled={isWorkersLoading || !!workersError}
                            >
                                <option value="">
                                    {isWorkersLoading
                                        ? 'Loading workers...'
                                        : workersError
                                            ? 'Failed to load workers'
                                            : '— None (ownerless system) —'}
                                </option>
                                {workers.map((worker) => (
                                    <option key={worker.oid} value={worker.oid}>
                                        {worker.fullname} ({worker.stable_id})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>Account OID</label>
                            <input
                                type="text"
                                value={accountOid}
                                onChange={(e) => setAccountOid(e.target.value)}
                                className={inputClass}
                                placeholder="Optional account OID"
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                className={inputClass}
                                placeholder="What does this system do?"
                            />
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="submit"
                            disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50"
                            data-testid="system-create-submit"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Create System</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push('/data/systems')}
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
