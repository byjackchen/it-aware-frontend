'use client';

/**
 * Incident detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
    ArrowLeft,
    AlertCircle,
    User,
    Building2,
    Pencil,
    Save,
    Trash2,
    Loader2,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { ObjectGraph } from '@/components/data';
import type { Incident, GlobalEdge, Organization, Worker, ServiceCatalog } from '@/lib/types/objects';
import { updateIncidentAction, deleteIncidentAction } from '@/app/actions/objects';

interface IncidentDetailPageProps {
    incident: Incident;
    edges: GlobalEdge[];
    organizations: Organization[];
    workers: Worker[];
    serviceCatalogs: ServiceCatalog[];
}

const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low', 'none'];
const URGENCY_OPTIONS = ['critical', 'high', 'medium', 'low', 'none'];
const STATE_OPTIONS = ['new', 'open', 'in_progress', 'pending', 'resolved', 'closed'];

export function IncidentDetailPage({ incident, edges, organizations, workers, serviceCatalogs }: IncidentDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    // Form State
    const [title, setTitle] = useState(incident.title);
    const [description, setDescription] = useState(incident.description || '');
    const [priority, setPriority] = useState(incident.priority || 'none');
    const [urgency, setUrgency] = useState(incident.urgency || 'none');
    const [state, setState] = useState(incident.state);
    const [channel, setChannel] = useState(incident.channel || '');
    const [assignedToOid, setAssignedToOid] = useState(incident.assigned_to_oid || '');
    const [serviceCatalogOid, setServiceCatalogOid] = useState(incident.service_catalog_oid || '');
    const [assignedGroup, setAssignedGroup] = useState(incident.assigned_group || '');
    const [configurationItemOid, setConfigurationItemOid] = useState(incident.configuration_item_oid || '');
    const [chatTranscripts, setChatTranscripts] = useState(
        incident.chat_transcripts ? JSON.stringify(incident.chat_transcripts, null, 2) : ''
    );
    const [sourceSystem, setSourceSystem] = useState(incident.source_system || '');
    const [fact, setFact] = useState(incident.fact || '');

    const assignedWorkerName = workers.find((w) => w.oid === incident.assigned_to_oid)?.fullname || 'Unassigned';
    const creator = workers.find((w) => w.oid === incident.actor_oid);
    const creatorStableId = creator?.stable_id || 'Unknown';
    const actorRoleLabel = incident.actor_role || 'caller';
    const actorOidLabel = incident.actor_oid || 'Unknown';

    const filteredEdges = edgeFilter ? edges.filter((e) => {
        const connectedObject = e.from_oid === incident.oid ? e.to_object : e.from_object;
        return connectedObject?.object_type === edgeFilter;
    }) : edges;

    const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
        critical: { bg: 'bg-red-500/20', text: 'text-red-500' },
        high: { bg: 'bg-orange-500/20', text: 'text-orange-500' },
        medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
        low: { bg: 'bg-green-500/20', text: 'text-green-500' },
        none: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
    };

    const priorityStyle = PRIORITY_COLORS[incident.priority?.toLowerCase() || 'none'] || PRIORITY_COLORS.none;

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
            formData.set('description', description);
            formData.set('priority', priority);
            formData.set('urgency', urgency);
            formData.set('state', state);
            formData.set('channel', channel);
            if (assignedToOid) formData.set('assigned_to_oid', assignedToOid);
            if (serviceCatalogOid) formData.set('service_catalog_oid', serviceCatalogOid);
            formData.set('assigned_group', assignedGroup);
            if (configurationItemOid) formData.set('configuration_item_oid', configurationItemOid);
            if (chatTranscriptsTrimmed) formData.set('chat_transcripts', chatTranscriptsTrimmed);
            if (sourceSystem) formData.set('source_system', sourceSystem);
            formData.set('fact', fact);

            await updateIncidentAction(incident.oid, formData);
            setIsEditing(false);
            router.refresh();
        } catch (error) {
            console.error('Failed to update incident:', error);
            alert('Failed to update incident');
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete this incident?')) return;
        setIsPending(true);
        try {
            await deleteIncidentAction(incident.oid);
            router.push('/data/incidents');
        } catch (error) {
            console.error('Failed to delete incident:', error);
            alert('Failed to delete incident');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setTitle(incident.title);
        setDescription(incident.description || '');
        setPriority(incident.priority || 'none');
        setUrgency(incident.urgency || 'none');
        setState(incident.state);
        setChannel(incident.channel || '');
        setAssignedToOid(incident.assigned_to_oid || '');
        setServiceCatalogOid(incident.service_catalog_oid || '');
        setAssignedGroup(incident.assigned_group || '');
        setConfigurationItemOid(incident.configuration_item_oid || '');
        setChatTranscripts(incident.chat_transcripts ? JSON.stringify(incident.chat_transcripts, null, 2) : '');
        setSourceSystem(incident.source_system || '');
        setFact(incident.fact || '');
        setIsEditing(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/data/incidents')} className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400'}`}>
                                <AlertCircle className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Incident Details</h1>
                                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {incident.incident_id}
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
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>
                                {incident.state}
                            </div>
                        )}
                    </div>
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Title + Source System */}
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
                                <div className={`text-xl font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{incident.title}</div>
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
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{incident.source_system || 'Unknown'}</div>
                            )}
                        </div>
                    </div>

                    {/* Description */}
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
                                {incident.description || <span className="italic opacity-50">No description provided</span>}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Priority */}
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
                                    {incident.priority || 'None'}
                                </div>
                            )}
                        </div>

                        {/* Urgency */}
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
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{incident.urgency || 'None'}</div>
                            )}
                        </div>

                        {/* Channel */}
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
                                <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{incident.channel || 'Unknown'}</div>
                            )}
                        </div>

                        {/* State (Editable only in edit mode) */}
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
                                <div className={`flex items-center gap-1.5 text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                    <span className="capitalize">{incident.state}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Actor</label>
                        <div className={`flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                            <User className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                            <span className="text-sm capitalize">{actorRoleLabel}:</span>
                            {creator ? (
                                <Link href={`/data/workers/${creator.oid}`} className="underline underline-offset-4">
                                    {creatorStableId}
                                </Link>
                            ) : (
                                <span className="font-mono text-xs">{actorOidLabel}</span>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        {/* Assigned Group */}
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
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{incident.assigned_group || 'None'}</span>
                                </div>
                            )}
                        </div>

                        {/* Assigned To */}
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
                        {/* Service Catalog */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Service Catalog</label>
                            {isEditing ? (
                                <select
                                    value={serviceCatalogOid}
                                    onChange={(e) => setServiceCatalogOid(e.target.value)}
                                    className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                >
                                    <option value="">None</option>
                                    {serviceCatalogs.map(sc => (
                                        <option key={sc.oid} value={sc.oid}>{sc.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    <Building2 className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                        {serviceCatalogs.find(sc => sc.oid === incident.service_catalog_oid)?.name || 'None'}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Configuration Item */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Configuration Item OID</label>
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
                                    <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{incident.configuration_item_oid || 'None'}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Created At</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{new Date(incident.created_at).toLocaleString()}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Updated At</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{new Date(incident.updated_at).toLocaleString()}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Effective At</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{new Date(incident.effective_at).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            Fact (Registry Descriptor)
                            <span className="ml-2 text-xs opacity-60 font-normal">Explicitly updated.</span>
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
                                {incident.fact || <span className="italic opacity-50">No fact descriptor set</span>}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Embedding ID</span>
                            <span className="font-mono text-xs select-all">{incident.embedding_id || '—'}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Embedded At</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                {incident.embedded_at ? new Date(incident.embedded_at).toLocaleString() : '—'}
                            </span>
                        </div>
                    </div>

                    {/* Chat Transcripts */}
                    <div className="pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Chat Transcripts (JSON)</label>
                        {isEditing ? (
                            <textarea
                                value={chatTranscripts}
                                onChange={(e) => setChatTranscripts(e.target.value)}
                                rows={4}
                                className={`w-full px-3 py-2 rounded-lg font-mono text-sm ${isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/10 text-white'}`}
                                placeholder='[{\"role\":\"user\",\"message\":\"...\"}]'
                            />
                        ) : (
                            <div className={`p-4 rounded-lg whitespace-pre-wrap font-mono text-xs ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                                {incident.chat_transcripts
                                    ? JSON.stringify(incident.chat_transcripts, null, 2)
                                    : <span className="italic opacity-50">No chat transcripts</span>}
                            </div>
                        )}
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
                                <span>Delete Incident</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('common.edgeRelationships')}</h2>
                    <ObjectGraph
                        oid={incident.oid}
                        objectType="incident"
                        descriptor={incident.title}
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
