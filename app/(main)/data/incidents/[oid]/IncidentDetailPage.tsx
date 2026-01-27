'use client';

/**
 * Incident detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    AlertCircle,
    Calendar,
    User,
    CheckCircle,
    XCircle,
    Building2,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { ObjectGraph } from '@/components/data';
import type { Incident, GlobalEdge, Organization, Worker } from '@/lib/types/objects';

interface IncidentDetailPageProps {
    incident: Incident;
    edges: GlobalEdge[];
    organizations: Organization[];
    workers: Worker[];
}

export function IncidentDetailPage({ incident, edges, organizations, workers }: IncidentDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    const worker = workers.find((w) => w.oid === incident.assigned_to_oid);
    const assignedWorkerName = worker ? worker.fullname : 'Unassigned';

    const creator = workers.find(w => w.oid === incident.actor_oid);
    const creatorName = creator ? creator.fullname : 'Unknown Creator';

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

                    {/* State Badge */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>
                        {incident.state}
                    </div>
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Title */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Title</label>
                        <div className={`text-xl font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{incident.title}</div>
                    </div>

                    {/* Description */}
                    {incident.description && (
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Description</label>
                            <div className={`p-4 rounded-lg whitespace-pre-wrap ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                                {incident.description}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Priority */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Priority</label>
                            <div className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${priorityStyle.bg} ${priorityStyle.text}`}>
                                {incident.priority || 'None'}
                            </div>
                        </div>

                        {/* Urgency */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Urgency</label>
                            <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{incident.urgency || 'None'}</div>
                        </div>

                        {/* Channel */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Channel</label>
                            <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{incident.channel || 'Unknown'}</div>
                        </div>

                        {/* Created */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Created</label>
                            <div className={`flex items-center gap-1.5 text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{new Date(incident.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        {/* Assigned To */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Assigned To</label>
                            <div className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <User className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{assignedWorkerName}</span>
                            </div>
                        </div>

                        {/* Created By (Actor) */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Created By</label>
                            <div className={`flex items-center gap-2 p-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <User className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{creatorName}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>Relationships</h2>
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
