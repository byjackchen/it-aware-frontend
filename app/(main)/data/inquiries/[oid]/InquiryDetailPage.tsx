'use client';

/**
 * Inquiry detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    MessageCircle,
    Calendar,
    User,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { ObjectGraph } from '@/components/data';
import type { Inquiry, GlobalEdge, Worker } from '@/lib/types/objects';

interface InquiryDetailPageProps {
    inquiry: Inquiry;
    edges: GlobalEdge[];
    workers: Worker[];
}

export function InquiryDetailPage({ inquiry, edges, workers }: InquiryDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    const creator = workers.find(w => w.oid === inquiry.actor_oid);
    const creatorName = creator ? creator.fullname : 'Unknown Creator';

    const filteredEdges = edgeFilter ? edges.filter((e) => {
        const connectedObject = e.from_oid === inquiry.oid ? e.to_object : e.from_object;
        return connectedObject?.object_type === edgeFilter;
    }) : edges;

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

                    {/* State Badge */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>
                        {inquiry.state}
                    </div>
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Topic */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Topic</label>
                        <div className={`text-xl font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>{inquiry.topic || 'Untitled Inquiry'}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Created */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Created</label>
                            <div className={`flex items-center gap-1.5 text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{new Date(inquiry.created_at).toLocaleString()}</span>
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

                    {/* Messages (JSON view for now) */}
                    <div>
                        <label className={`block text-sm font-medium mb-2 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>Messages</label>
                        <div className={`p-4 rounded-lg overflow-x-auto ${isLight ? 'bg-slate-50' : 'bg-black/20'}`}>
                            <pre className={`text-xs font-mono ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                {JSON.stringify(inquiry.messages, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>Relationships</h2>
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
