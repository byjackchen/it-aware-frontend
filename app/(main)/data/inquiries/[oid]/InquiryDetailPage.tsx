'use client';

/**
 * Inquiry detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
    ArrowLeft,
    MessageCircle,
    User,
    Pencil,
    Save,
    Trash2,
    Loader2,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { ObjectGraph } from '@/components/data';
import type { Inquiry, GlobalEdge, Worker } from '@/lib/types/objects';
import { updateInquiryAction, deleteInquiryAction } from '@/app/actions/objects';

interface InquiryDetailPageProps {
    inquiry: Inquiry;
    edges: GlobalEdge[];
    workers: Worker[];
}

const STATE_OPTIONS = ['new', 'open', 'in_progress', 'pending', 'resolved', 'closed'];

export function InquiryDetailPage({ inquiry, edges, workers }: InquiryDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    // Form State
    const [topic, setTopic] = useState(inquiry.topic || '');
    const [state, setState] = useState(inquiry.state);
    const [fact, setFact] = useState(inquiry.fact || '');
    const [sourceSystem, setSourceSystem] = useState(inquiry.source_system || '');
    const [messagesJson, setMessagesJson] = useState(JSON.stringify(inquiry.messages || [], null, 2));
    const [createdAt, setCreatedAt] = useState(inquiry.created_at);
    const [updatedAt, setUpdatedAt] = useState(inquiry.updated_at);
    const [effectiveAt, setEffectiveAt] = useState(inquiry.effective_at);

    const creator = workers.find((w) => w.oid === inquiry.actor_oid);
    const creatorStableId = creator?.stable_id || 'Unknown';
    const actorRoleLabel = inquiry.actor_role || 'user';
    const actorOidLabel = inquiry.actor_oid || 'Unknown';

    const filteredEdges = edgeFilter ? edges.filter((e) => {
        const connectedObject = e.from_oid === inquiry.oid ? e.to_object : e.from_object;
        return connectedObject?.object_type === edgeFilter;
    }) : edges;

    const handleSave = async () => {
        setIsPending(true);
        try {
            // Validate JSON
            let parsedMessages = [];
            try {
                parsedMessages = JSON.parse(messagesJson);
            } catch (e) {
                alert('Invalid JSON in Messages field');
                setIsPending(false);
                return;
            }

            const formData = new FormData();
            formData.set('topic', topic);
            formData.set('state', state);
            formData.set('fact', fact);
            if (sourceSystem.trim()) formData.set('source_system', sourceSystem.trim());
            formData.set('messages', JSON.stringify(parsedMessages));
            if (createdAt.trim()) formData.set('created_at', createdAt.trim());
            if (updatedAt.trim()) formData.set('updated_at', updatedAt.trim());
            if (effectiveAt.trim()) formData.set('effective_at', effectiveAt.trim());

            await updateInquiryAction(inquiry.oid, formData);
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error('Failed to update inquiry:', error);
            alert('Failed to update inquiry');
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this inquiry?')) return;
        setIsPending(true);
        try {
            await deleteInquiryAction(inquiry.oid);
            router.push('/data/inquiries');
        } catch (error) {
            console.error('Failed to delete inquiry:', error);
            alert('Failed to delete inquiry');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setTopic(inquiry.topic || '');
        setState(inquiry.state);
        setFact(inquiry.fact || '');
        setSourceSystem(inquiry.source_system || '');
        setMessagesJson(JSON.stringify(inquiry.messages || [], null, 2));
        setCreatedAt(inquiry.created_at);
        setUpdatedAt(inquiry.updated_at);
        setEffectiveAt(inquiry.effective_at);
        setIsEditing(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/data/inquiries')} className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}`}>
                                <MessageCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Inquiry Details</h1>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isEditing && (
                            <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors">
                                <Pencil className="w-4 h-4" />
                                <span>Edit</span>
                            </button>
                        )}
                        {/* State Badge */}
                        {!isEditing && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>
                                {inquiry.state}
                            </div>
                        )}
                    </div>
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Topic */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Topic</label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                            />
                        ) : (
                            <div className={`text-xl font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{inquiry.topic || 'Untitled Inquiry'}</div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* State (Editable) */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>State</label>
                            {isEditing ? (
                                <select
                                    value={state}
                                    onChange={(e) => setState(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg capitalization ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                >
                                    {STATE_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt.replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{inquiry.state}</div>
                            )}
                        </div>
                    </div>

                    {/* Messages (JSON view) */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Messages (JSON)</label>
                        {isEditing ? (
                            <textarea
                                value={messagesJson}
                                onChange={(e) => setMessagesJson(e.target.value)}
                                rows={8}
                                className={`w-full px-3 py-2 rounded-lg font-mono text-xs ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                            />
                        ) : (
                            <div className={`p-4 rounded-lg overflow-x-auto ${isLight ? 'bg-slate-50' : 'bg-black/20'}`}>
                                <pre className={`text-xs font-mono ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                    {JSON.stringify(inquiry.messages, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>

                    {/* Shared Activity Metadata */}
                    <div className={`border border-dashed rounded-xl p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Actor</span>
                                <div className={`flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                    <User className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                    {creator ? (
                                        <Link href={`/data/workers/${creator.oid}`} className="underline underline-offset-4">
                                            {creatorStableId}
                                        </Link>
                                    ) : (
                                        <span className="font-mono text-xs">{actorOidLabel}</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Actor Role</span>
                                <span className="text-sm">{actorRoleLabel}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Source System</span>
                                {isEditing ? (
                                    <input
                                        type="text"
                                        value={sourceSystem}
                                        onChange={(e) => setSourceSystem(e.target.value)}
                                        className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                        placeholder="e.g. Slack, Web"
                                    />
                                ) : (
                                    <span className="text-sm">{inquiry.source_system || 'Unknown'}</span>
                                )}
                            </div>
                            <div>
                                {isEditing ? (
                                    <>
                                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Created At (ISO 8601)</label>
                                        <input
                                            type="text"
                                            value={createdAt}
                                            onChange={(e) => setCreatedAt(e.target.value)}
                                            className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                            placeholder="2026-02-02T12:34:56Z"
                                        />
                                    </>
                                ) : (
                                    <>
                                        <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Created At</span>
                                        <span className="text-sm">{new Date(inquiry.created_at).toLocaleString()}</span>
                                    </>
                                )}
                            </div>
                            <div>
                                {isEditing ? (
                                    <>
                                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Updated At (ISO 8601)</label>
                                        <input
                                            type="text"
                                            value={updatedAt}
                                            onChange={(e) => setUpdatedAt(e.target.value)}
                                            className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                            placeholder="2026-02-02T12:34:56Z"
                                        />
                                    </>
                                ) : (
                                    <>
                                        <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Updated At</span>
                                        <span className="text-sm">{new Date(inquiry.updated_at).toLocaleString()}</span>
                                    </>
                                )}
                            </div>
                            <div>
                                {isEditing ? (
                                    <>
                                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Effective At (ISO 8601)</label>
                                        <input
                                            type="text"
                                            value={effectiveAt}
                                            onChange={(e) => setEffectiveAt(e.target.value)}
                                            className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                            placeholder="2026-02-02T12:34:56Z"
                                        />
                                    </>
                                ) : (
                                    <>
                                        <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Effective At</span>
                                        <span className="text-sm">{new Date(inquiry.effective_at).toLocaleString()}</span>
                                    </>
                                )}
                            </div>
                            <div className="md:col-span-2">
                                <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                    Fact (Registry Descriptor)
                                    <span className="ml-2 text-xs opacity-60 font-normal">Updates trigger embedding refresh.</span>
                                </label>
                                {isEditing ? (
                                    <textarea
                                        value={fact}
                                        onChange={(e) => setFact(e.target.value)}
                                        rows={2}
                                        className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                    />
                                ) : (
                                    <div className={`p-3 rounded-lg whitespace-pre-wrap ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                                        {inquiry.fact || <span className="italic opacity-50">No fact descriptor set</span>}
                                    </div>
                                )}
                            </div>
                            <div>
                                <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Fact Embedding ID</span>
                                <span className="font-mono text-xs select-all">{inquiry.fact_embedding_id || '—'}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Fact Embedded At</span>
                                <span className="text-sm">{inquiry.fact_embedded_at ? new Date(inquiry.fact_embedded_at).toLocaleString() : '—'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {isEditing ? (
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleSave} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>Save</span>
                            </button>
                            <button onClick={handleCancel} disabled={isPending} className={`px-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>Cancel</button>
                        </div>
                    ) : (
                        <div className={`pt-4 border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                            <button onClick={handleDelete} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                <span>Delete Inquiry</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('common.edgeRelationships')}</h2>
                    <ObjectGraph
                        oid={inquiry.oid}
                        objectType="inquiry"
                        descriptor={inquiry.topic || 'Inquiry'}
                        edges={filteredEdges}
                        allEdges={edges}
                        onFilterChange={setEdgeFilter}
                        selectedFilter={edgeFilter}
                    />
                </div>
            </div>
        </div>
    );
}
