'use client';

/**
 * Request detail page client component.
 */

import { useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
    ArrowLeft,
    ClipboardList,
    User,
    Building2,
    Pencil,
    Save,
    Trash2,
    Loader2,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { ActorBadge, ObjectGraph, Phase2FieldsCard } from '@/components/data';
import { formatDateTime } from '@/lib/utils/datetime';
import type { Request, GlobalEdge, Worker, ServiceCatalog } from '@/lib/types/objects';
import { updateRequestAction, deleteRequestAction } from '@/app/actions/objects';

interface RequestDetailPageProps {
    request: Request;
    edges: GlobalEdge[];
    workers: Worker[];
    serviceCatalogs: ServiceCatalog[];
}

const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low', 'none'];
const URGENCY_OPTIONS = ['critical', 'high', 'medium', 'low', 'none'];
const STATE_OPTIONS = ['Pending', 'Open', 'Work in Progress', 'Closed Complete', 'Closed Incomplete', 'Closed Skipped'];

export function RequestDetailPage({ request, edges, workers, serviceCatalogs }: RequestDetailPageProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useTransitionRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    const [title, setTitle] = useState(request.title);
    const [stableId, setStableId] = useState(request.stable_id || '');
    const [description, setDescription] = useState(request.description || '');
    const [priority, setPriority] = useState(request.priority || 'none');
    const [urgency, setUrgency] = useState(request.urgency || 'none');
    const [state, setState] = useState(request.state);
    const [channel, setChannel] = useState(request.channel || '');
    const [itemField, setItemField] = useState(request.item || '');
    const [requestItem, setRequestItem] = useState(request.request_item || '');
    const [callerName, setCallerName] = useState(request.caller_name || '');
    const [assignedToName, setAssignedToName] = useState(request.assigned_to_name || '');
    const [snId, setSnId] = useState(request.sn_id || '');
    const [category, setCategory] = useState(request.category || '');
    const [subcategory, setSubcategory] = useState(request.subcategory || '');
    const [impact, setImpact] = useState(request.impact || '');
    const [assignedToOid, setAssignedToOid] = useState(request.assigned_to_oid || '');
    // UI edits write to the *_override fields; ServiceNow sync continues to
    // populate the no-suffix default. Effective value (override || default)
    // is shown in the read-only badge below.
    const [serviceCatalogOverrideOid, setServiceCatalogOverrideOid] = useState(
        request.service_catalog_override_oid || '',
    );
    const [serviceTypeOverrideOid, setServiceTypeOverrideOid] = useState(
        request.service_type_override_oid || '',
    );
    const [assignedGroup, setAssignedGroup] = useState(request.assigned_group || '');
    const [configurationItemOid, setConfigurationItemOid] = useState(request.configuration_item_oid || '');
    const [chatTranscripts, setChatTranscripts] = useState(
        request.chat_transcripts ? JSON.stringify(request.chat_transcripts, null, 2) : ''
    );
    const [sourceSystem, setSourceSystem] = useState(request.source_system || '');
    const [fact, setFact] = useState(request.fact || '');
    const [createdAt, setCreatedAt] = useState(request.created_at);
    const [updatedAt, setUpdatedAt] = useState(request.updated_at);
    const [effectiveAt, setEffectiveAt] = useState(request.effective_at);

    const assignedWorkerName = workers.find((w) => w.oid === request.assigned_to_oid)?.fullname || 'Unassigned';

    const filteredEdges = edgeFilter ? edges.filter((e) => {
        const connectedObject = e.from_oid === request.oid ? e.to_object : e.from_object;
        return connectedObject?.object_type === edgeFilter;
    }) : edges;

    const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
        critical: { bg: 'bg-red-500/20', text: 'text-red-500' },
        high: { bg: 'bg-orange-500/20', text: 'text-orange-500' },
        medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
        low: { bg: 'bg-green-500/20', text: 'text-green-500' },
        none: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
    };

    const priorityStyle = PRIORITY_COLORS[request.priority?.toLowerCase() || 'none'] || PRIORITY_COLORS.none;

    const handleSave = async () => {
        setIsPending(true);
        try {
            const chatTranscriptsTrimmed = chatTranscripts.trim();
            if (chatTranscriptsTrimmed) {
                try {
                    JSON.parse(chatTranscriptsTrimmed);
                } catch {
                    alert('Chat transcripts must be valid JSON.');
                    return;
                }
            }

            const formData = new FormData();
            formData.set('title', title);
            formData.set('stable_id', stableId);
            formData.set('description', description);
            formData.set('priority', priority);
            formData.set('urgency', urgency);
            formData.set('state', state);
            formData.set('channel', channel);
            if (itemField) formData.set('item', itemField);
            if (requestItem) formData.set('request_item', requestItem);
            if (callerName) formData.set('caller_name', callerName);
            if (assignedToName) formData.set('assigned_to_name', assignedToName);
            if (snId) formData.set('sn_id', snId);
            if (category) formData.set('category', category);
            if (subcategory) formData.set('subcategory', subcategory);
            if (impact) formData.set('impact', impact);
            if (assignedToOid) formData.set('assigned_to_oid', assignedToOid);
            formData.set('service_catalog_override_oid', serviceCatalogOverrideOid);
            formData.set('service_type_override_oid', serviceTypeOverrideOid);
            formData.set('assigned_group', assignedGroup);
            if (configurationItemOid) formData.set('configuration_item_oid', configurationItemOid);
            if (chatTranscriptsTrimmed) formData.set('chat_transcripts', chatTranscriptsTrimmed);
            if (sourceSystem) formData.set('source_system', sourceSystem);
            formData.set('fact', fact);
            if (createdAt.trim()) formData.set('created_at', createdAt.trim());
            if (updatedAt.trim()) formData.set('updated_at', updatedAt.trim());
            if (effectiveAt.trim()) formData.set('effective_at', effectiveAt.trim());

            await updateRequestAction(request.oid, formData);
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error('Failed to update request:', error);
            alert(error instanceof Error ? error.message : 'Failed to update request');
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this request?')) return;
        setIsPending(true);
        try {
            await deleteRequestAction(request.oid);
            router.push('/data/requests');
        } catch (error) {
            console.error('Failed to delete request:', error);
            alert(error instanceof Error ? error.message : 'Failed to delete request');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setTitle(request.title);
        setStableId(request.stable_id || '');
        setDescription(request.description || '');
        setPriority(request.priority || 'none');
        setUrgency(request.urgency || 'none');
        setState(request.state);
        setChannel(request.channel || '');
        setItemField(request.item || '');
        setRequestItem(request.request_item || '');
        setCallerName(request.caller_name || '');
        setAssignedToName(request.assigned_to_name || '');
        setSnId(request.sn_id || '');
        setCategory(request.category || '');
        setSubcategory(request.subcategory || '');
        setImpact(request.impact || '');
        setAssignedToOid(request.assigned_to_oid || '');
        setServiceCatalogOverrideOid(request.service_catalog_override_oid || '');
        setServiceTypeOverrideOid(request.service_type_override_oid || '');
        setAssignedGroup(request.assigned_group || '');
        setConfigurationItemOid(request.configuration_item_oid || '');
        setChatTranscripts(request.chat_transcripts ? JSON.stringify(request.chat_transcripts, null, 2) : '');
        setSourceSystem(request.source_system || '');
        setFact(request.fact || '');
        setCreatedAt(request.created_at);
        setUpdatedAt(request.updated_at);
        setEffectiveAt(request.effective_at);
        setIsEditing(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/data/requests')} className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-400'}`}>
                                <ClipboardList className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Request Details</h1>
                                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {request.stable_id || '—'}
                                </p>
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
                        {!isEditing && (
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>
                                {request.state}
                            </div>
                        )}
                    </div>
                </div>

                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-2">
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Title</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                />
                            ) : (
                                <div className={`text-xl font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{request.title}</div>
                            )}
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Source System</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={sourceSystem}
                                    onChange={(e) => setSourceSystem(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                    placeholder="e.g. ServiceNow, Slack"
                                />
                            ) : (
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.source_system || 'Unknown'}</div>
                            )}
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Stable ID</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={stableId}
                                    onChange={(e) => setStableId(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                    placeholder="e.g. REQ-12345"
                                />
                            ) : (
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.stable_id || '—'}</div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Description</label>
                        {isEditing ? (
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                            />
                        ) : (
                            <div className={`p-4 rounded-lg whitespace-pre-wrap ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                                {request.description || <span className="italic opacity-50">No description provided</span>}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Priority</label>
                            {isEditing ? (
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg capitalization ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                >
                                    {PRIORITY_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${priorityStyle.bg} ${priorityStyle.text}`}>
                                    {request.priority || 'None'}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Urgency</label>
                            {isEditing ? (
                                <select
                                    value={urgency}
                                    onChange={(e) => setUrgency(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg capitalization ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                >
                                    {URGENCY_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.urgency || 'None'}</div>
                            )}
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Channel</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={channel}
                                    onChange={(e) => setChannel(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                />
                            ) : (
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.channel || 'Unknown'}</div>
                            )}
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>State</label>
                            {isEditing ? (
                                <select
                                    value={state}
                                    onChange={(e) => setState(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                >
                                    {STATE_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className={`flex items-center gap-1.5 text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                    <span>{request.state}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Item / Request Item / SN ID */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Item</label>
                            {isEditing ? (
                                <input type="text" value={itemField} onChange={(e) => setItemField(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`} />
                            ) : (
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.item || '—'}</div>
                            )}
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Request Item</label>
                            {isEditing ? (
                                <input type="text" value={requestItem} onChange={(e) => setRequestItem(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`} />
                            ) : (
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.request_item || '—'}</div>
                            )}
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>SN ID</label>
                            {isEditing ? (
                                <input type="text" value={snId} onChange={(e) => setSnId(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`} />
                            ) : (
                                <div className={`text-sm font-mono ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.sn_id || '—'}</div>
                            )}
                        </div>
                    </div>

                    {/* Caller Name / Assigned To Name */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Caller Name</label>
                            {isEditing ? (
                                <input type="text" value={callerName} onChange={(e) => setCallerName(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`} />
                            ) : (
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.caller_name || '—'}</div>
                            )}
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Assigned To Name</label>
                            {isEditing ? (
                                <input type="text" value={assignedToName} onChange={(e) => setAssignedToName(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`} />
                            ) : (
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.assigned_to_name || '—'}</div>
                            )}
                        </div>
                    </div>

                    {/* Category / Subcategory / Impact */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Category</label>
                            {isEditing ? (
                                <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`} />
                            ) : (
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.category || '—'}</div>
                            )}
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Subcategory</label>
                            {isEditing ? (
                                <input type="text" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`} />
                            ) : (
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.subcategory || '—'}</div>
                            )}
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Impact</label>
                            {isEditing ? (
                                <input type="text" value={impact} onChange={(e) => setImpact(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`} />
                            ) : (
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.impact || '—'}</div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Actor</label>
                        <ActorBadge
                            actorType={request.actor_type}
                            actorStableId={request.actor_stable_id}
                            actorOid={request.actor_oid}
                            actorRole={request.actor_role}
                            defaultRole="requester"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Assigned Group</label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={assignedGroup}
                                    onChange={(e) => setAssignedGroup(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                />
                            ) : (
                                <div className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{request.assigned_group || 'None'}</span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Assigned To</label>
                            {isEditing ? (
                                <select
                                    value={assignedToOid}
                                    onChange={(e) => setAssignedToOid(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                >
                                    <option value="">Unassigned</option>
                                    {workers.map(w => (
                                        <option key={w.oid} value={w.oid}>{w.fullname} ({w.email})</option>
                                    ))}
                                </select>
                            ) : (
                                <div className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    <User className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{assignedWorkerName}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Service Catalog</label>
                            {isEditing ? (
                                <select
                                    value={serviceCatalogOverrideOid}
                                    onChange={(e) => setServiceCatalogOverrideOid(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                    title="Override the source-system value; clear to fall back to ServiceNow"
                                >
                                    <option value="">No override (use source value)</option>
                                    {serviceCatalogs.map(sc => (
                                        <option key={sc.oid} value={sc.oid}>{sc.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    <Building2 className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                        {serviceCatalogs.find(sc => sc.oid === (request.service_catalog_override_oid ?? request.service_catalog_oid))?.name || 'None'}
                                        {request.service_catalog_override_oid && request.service_catalog_override_oid !== request.service_catalog_oid && (
                                            <span className="ml-2 text-[10px] uppercase tracking-wider opacity-60">override</span>
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Service Type</label>
                            {isEditing ? (
                                <select
                                    value={serviceTypeOverrideOid}
                                    onChange={(e) => setServiceTypeOverrideOid(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                    title="Override the AI-derived type; clear to fall back"
                                >
                                    <option value="">No override (use source value)</option>
                                    {serviceCatalogs
                                        .filter(sc => (sc.stable_id ?? '').startsWith('ITST') && (sc.path?.length ?? 0) === 2)
                                        .map(sc => (
                                            <option key={sc.oid} value={sc.oid}>{sc.name}</option>
                                        ))}
                                </select>
                            ) : (
                                <div className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    <Building2 className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                        {serviceCatalogs.find(sc => sc.oid === (request.service_type_override_oid ?? request.service_type_oid))?.name || 'None'}
                                        {request.service_type_override_oid && request.service_type_override_oid !== request.service_type_oid && (
                                            <span className="ml-2 text-[10px] uppercase tracking-wider opacity-60">override</span>
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                {isEditing ? 'Configuration Item OID' : 'Configuration Item'}
                            </label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={configurationItemOid}
                                    onChange={(e) => setConfigurationItemOid(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                    placeholder="Optional configuration item OID"
                                />
                            ) : (
                                <div className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    <Building2 className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                        {serviceCatalogs.find(sc => sc.oid === request.configuration_item_oid)?.name || request.configuration_item_oid || 'None'}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
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
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(request.created_at, timezone)}</span>
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
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(request.updated_at, timezone)}</span>
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
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(request.effective_at, timezone)}</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
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
                                {request.fact || <span className="italic opacity-50">No fact descriptor set</span>}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Fact Embedding ID</span>
                            <span className="font-mono text-xs select-all">{request.fact_embedding_id || '—'}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Fact Embedded At</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                {formatDateTime(request.fact_embedded_at, timezone)}
                            </span>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Chat Transcripts (JSON)</label>
                        {isEditing ? (
                            <textarea
                                value={chatTranscripts}
                                onChange={(e) => setChatTranscripts(e.target.value)}
                                rows={4}
                                className={`w-full px-3 py-2 rounded-lg font-mono text-sm ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                placeholder='[{"role":"user","message":"..."}]'
                            />
                        ) : (
                            <div className={`p-4 rounded-lg whitespace-pre-wrap font-mono text-xs ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                                {request.chat_transcripts
                                    ? JSON.stringify(request.chat_transcripts, null, 2)
                                    : <span className="italic opacity-50">No chat transcripts</span>}
                            </div>
                        )}
                    </div>

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
                                <span>Delete Request</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Phase 2 — ServiceNow-authoritative fields (read-only). */}
                <Phase2FieldsCard data={request} variant="request" />

                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('common.edgeRelationships')}</h2>
                    <ObjectGraph
                        oid={request.oid}
                        objectType="request"
                        descriptor={request.title}
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
