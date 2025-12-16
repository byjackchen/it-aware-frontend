'use client';

/**
 * Ticket detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowLeft,
    Ticket,
    Trash2,
    Pencil,
    Save,
    Loader2,
    Calendar,
    Building2,
    User,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { ObjectGraph } from '@/components/data';
import type { Ticket as TicketType, GlobalEdge, Organization, Worker } from '@/lib/types/objects';
import { updateTicketAction, deleteTicketAction } from '../../actions';

interface TicketDetailPageProps {
    ticket: TicketType;
    edges: GlobalEdge[];
    organizations: Organization[];
    workers: Worker[];
}

const STATUS_OPTIONS = ['open', 'in_progress', 'pending', 'resolved', 'closed'];

export function TicketDetailPage({ ticket, edges, organizations, workers }: TicketDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [title, setTitle] = useState(ticket.title);
    const [status, setStatus] = useState(ticket.status);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    const orgName = organizations.find((o) => o.oid === ticket.org_oid)?.name || 'Unknown';
    const workerName = workers.find((w) => w.oid === ticket.worker_oid)?.full_name || 'Unknown';
    const filteredEdges = edgeFilter ? edges.filter((e) => e.edge_type === edgeFilter) : edges;

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('title', title);
            formData.set('status', status);
            await updateTicketAction(ticket.oid, formData);
            setIsEditing(false);
            router.refresh();
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('tickets.deleteConfirm'))) return;
        setIsPending(true);
        try {
            await deleteTicketAction(ticket.oid);
            router.push('/data/tickets');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setTitle(ticket.title);
        setStatus(ticket.status);
        setIsEditing(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/data/tickets')} className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                                <Ticket className="w-5 h-5" />
                            </div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('tickets.detail')}</h1>
                        </div>
                    </div>
                    {!isEditing && (
                        <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors">
                            <Pencil className="w-4 h-4" />
                            <span>{t('common.edit')}</span>
                        </button>
                    )}
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Title */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('tickets.ticketTitle')}</label>
                        {isEditing ? (
                            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full px-3 py-2 rounded-lg text-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`} />
                        ) : (
                            <div className={`px-3 py-2 rounded-lg text-lg ${isLight ? 'text-slate-800 bg-slate-50' : 'text-white bg-white/5'}`}>{ticket.title}</div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Status */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('tickets.status')}</label>
                            {isEditing ? (
                                <select value={status} onChange={(e) => setStatus(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`}>
                                    {STATUS_OPTIONS.map((s) => (
                                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className={`px-3 py-2 rounded-lg capitalize ${isLight ? 'bg-slate-50 text-slate-700' : 'bg-white/5 text-gray-300'}`}>
                                    {ticket.status.replace(/_/g, ' ')}
                                </div>
                            )}
                        </div>

                        {/* Created */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('common.created')}</label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Calendar className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{new Date(ticket.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Organization */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('workers.organization')}</label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Building2 className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{orgName}</span>
                            </div>
                        </div>

                        {/* Owner */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('tickets.owner')}</label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <User className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{workerName}</span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {isEditing ? (
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleSave} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>{t('common.save')}</span>
                            </button>
                            <button onClick={handleCancel} disabled={isPending} className={`px-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>{t('common.cancel')}</button>
                        </div>
                    ) : (
                        <div className={`pt-4 border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                            <button onClick={handleDelete} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                <span>{t('common.delete')} {t('tickets.title')}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('common.graphRelationships')}</h2>
                    <ObjectGraph
                        oid={ticket.oid}
                        objectType="ticket"
                        descriptor={ticket.title}
                        edges={filteredEdges}
                        onFilterChange={setEdgeFilter}
                        selectedFilter={edgeFilter}
                    />
                </div>
            </div>
        </div>
    );
}
