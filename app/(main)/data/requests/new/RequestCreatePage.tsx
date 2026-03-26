'use client';

/**
 * Request creation page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ClipboardList, Loader2, Save } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useLazyResourceList } from '@/lib/hooks/useLazyResourceList';
import type { ServiceCatalog, Worker } from '@/lib/types/objects';
import { createRequestAction } from '@/app/actions/objects';

const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low', 'none'];
const URGENCY_OPTIONS = ['critical', 'high', 'medium', 'low', 'none'];
const STATE_OPTIONS = ['Pending', 'Open', 'Work in Progress', 'Closed Complete', 'Closed Incomplete', 'Closed Skipped'];

export function RequestCreatePage() {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [title, setTitle] = useState('');
    const [actorOid, setActorOid] = useState('');
    const [state, setState] = useState('Open');

    const [stableId, setStableId] = useState('');
    const [actorRole, setActorRole] = useState('requester');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('none');
    const [urgency, setUrgency] = useState('none');
    const [channel, setChannel] = useState('');
    const [assignedToOid, setAssignedToOid] = useState('');
    const [serviceCatalogOid, setServiceCatalogOid] = useState('');
    const [assignedGroup, setAssignedGroup] = useState('');
    const [configurationItemOid, setConfigurationItemOid] = useState('');
    const [sourceSystem, setSourceSystem] = useState('');
    const [fact, setFact] = useState('');
    const [chatTranscripts, setChatTranscripts] = useState('');
    const [createdAt, setCreatedAt] = useState('');
    const [updatedAt, setUpdatedAt] = useState('');
    const [effectiveAt, setEffectiveAt] = useState('');

    const {
        items: workers,
        isLoading: isWorkersLoading,
        error: workersError,
    } = useLazyResourceList<Worker>('workers', {
        query: { limit: 1000 },
        auto: true,
    });

    const {
        items: serviceCatalogs,
        isLoading: isServiceCatalogsLoading,
        error: serviceCatalogsError,
    } = useLazyResourceList<ServiceCatalog>('service-catalogs', {
        query: { limit: 1000 },
        auto: true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!title.trim() || !actorOid || !state.trim()) {
            setError('Please fill in all required fields (Title, Actor, State).');
            return;
        }

        const chatTranscriptsTrimmed = chatTranscripts.trim();
        if (chatTranscriptsTrimmed) {
            try {
                JSON.parse(chatTranscriptsTrimmed);
            } catch {
                setError('Chat transcripts must be valid JSON.');
                return;
            }
        }

        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('title', title.trim());
            formData.set('actor_oid', actorOid);
            formData.set('state', state.trim());

            if (stableId.trim()) formData.set('stable_id', stableId.trim());
            if (actorRole.trim()) formData.set('actor_role', actorRole.trim());
            if (description.trim()) formData.set('description', description.trim());
            if (priority.trim()) formData.set('priority', priority.trim());
            if (urgency.trim()) formData.set('urgency', urgency.trim());
            if (channel.trim()) formData.set('channel', channel.trim());
            if (assignedToOid) formData.set('assigned_to_oid', assignedToOid);
            if (serviceCatalogOid) formData.set('service_catalog_oid', serviceCatalogOid);
            if (assignedGroup.trim()) formData.set('assigned_group', assignedGroup.trim());
            if (configurationItemOid.trim()) formData.set('configuration_item_oid', configurationItemOid.trim());
            if (sourceSystem.trim()) formData.set('source_system', sourceSystem.trim());
            if (fact.trim()) formData.set('fact', fact.trim());
            if (chatTranscriptsTrimmed) formData.set('chat_transcripts', chatTranscriptsTrimmed);
            if (createdAt.trim()) formData.set('created_at', createdAt.trim());
            if (updatedAt.trim()) formData.set('updated_at', updatedAt.trim());
            if (effectiveAt.trim()) formData.set('effective_at', effectiveAt.trim());

            await createRequestAction(formData);
            router.push('/data/requests');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create request.');
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
                        onClick={() => router.push('/data/requests')}
                        className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                    >
                        <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-400'}`}>
                            <ClipboardList className="w-5 h-5" />
                        </div>
                        <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>New Request</h1>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {error && (
                        <div className="p-3 rounded-lg bg-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Required</h3>

                        <div>
                            <label className={labelClass}>Title *</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className={inputClass}
                                placeholder="e.g. VPN access for onboarding"
                                required
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Actor *</label>
                            <select
                                value={actorOid}
                                onChange={(e) => setActorOid(e.target.value)}
                                className={inputClass}
                                disabled={isWorkersLoading || !!workersError}
                                required
                            >
                                <option value="">
                                    {isWorkersLoading
                                        ? 'Loading workers...'
                                        : workersError
                                            ? 'Failed to load workers'
                                            : 'Select actor worker...'}
                                </option>
                                {workers.map((worker) => (
                                    <option key={worker.oid} value={worker.oid}>{worker.fullname} ({worker.stable_id})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className={labelClass}>State *</label>
                            <select
                                value={state}
                                onChange={(e) => setState(e.target.value)}
                                className={inputClass}
                                required
                            >
                                {STATE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <h3 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>Optional</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Stable ID</label>
                                <input
                                    type="text"
                                    value={stableId}
                                    onChange={(e) => setStableId(e.target.value)}
                                    className={inputClass}
                                    placeholder="Leave blank to auto-generate"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Actor Role</label>
                                <input
                                    type="text"
                                    value={actorRole}
                                    onChange={(e) => setActorRole(e.target.value)}
                                    className={inputClass}
                                    placeholder="requester"
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Description</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                className={inputClass}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>Priority</label>
                                <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputClass}>
                                    {PRIORITY_OPTIONS.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Urgency</label>
                                <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className={inputClass}>
                                    {URGENCY_OPTIONS.map((option) => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Channel</label>
                                <input
                                    type="text"
                                    value={channel}
                                    onChange={(e) => setChannel(e.target.value)}
                                    className={inputClass}
                                    placeholder="e.g. slack, email"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Assigned To</label>
                                <select
                                    value={assignedToOid}
                                    onChange={(e) => setAssignedToOid(e.target.value)}
                                    className={inputClass}
                                    disabled={isWorkersLoading || !!workersError}
                                >
                                    <option value="">Unassigned</option>
                                    {workers.map((worker) => (
                                        <option key={worker.oid} value={worker.oid}>{worker.fullname} ({worker.stable_id})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Assigned Group</label>
                                <input
                                    type="text"
                                    value={assignedGroup}
                                    onChange={(e) => setAssignedGroup(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Service Catalog</label>
                                <select
                                    value={serviceCatalogOid}
                                    onChange={(e) => setServiceCatalogOid(e.target.value)}
                                    className={inputClass}
                                    disabled={isServiceCatalogsLoading || !!serviceCatalogsError}
                                >
                                    <option value="">None</option>
                                    {serviceCatalogs.map((catalog) => (
                                        <option key={catalog.oid} value={catalog.oid}>{catalog.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Configuration Item OID</label>
                                <input
                                    type="text"
                                    value={configurationItemOid}
                                    onChange={(e) => setConfigurationItemOid(e.target.value)}
                                    className={inputClass}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Source System</label>
                            <input
                                type="text"
                                value={sourceSystem}
                                onChange={(e) => setSourceSystem(e.target.value)}
                                className={inputClass}
                                placeholder="e.g. ServiceNow"
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Fact</label>
                            <textarea
                                value={fact}
                                onChange={(e) => setFact(e.target.value)}
                                rows={2}
                                className={inputClass}
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Chat Transcripts (JSON)</label>
                            <textarea
                                value={chatTranscripts}
                                onChange={(e) => setChatTranscripts(e.target.value)}
                                rows={4}
                                className={`${inputClass} font-mono text-sm`}
                                placeholder='[{"role":"user","message":"..."}]'
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>Created At (ISO 8601)</label>
                                <input
                                    type="text"
                                    value={createdAt}
                                    onChange={(e) => setCreatedAt(e.target.value)}
                                    className={inputClass}
                                    placeholder="2026-02-02T12:34:56Z"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Updated At (ISO 8601)</label>
                                <input
                                    type="text"
                                    value={updatedAt}
                                    onChange={(e) => setUpdatedAt(e.target.value)}
                                    className={inputClass}
                                    placeholder="2026-02-02T12:34:56Z"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Effective At (ISO 8601)</label>
                                <input
                                    type="text"
                                    value={effectiveAt}
                                    onChange={(e) => setEffectiveAt(e.target.value)}
                                    className={inputClass}
                                    placeholder="2026-02-02T12:34:56Z"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="submit" disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Create Request</span>
                        </button>
                        <button type="button" onClick={() => router.push('/data/requests')} disabled={isPending} className={`px-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
