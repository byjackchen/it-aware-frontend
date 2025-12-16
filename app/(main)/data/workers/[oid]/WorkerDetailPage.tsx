'use client';

/**
 * Worker detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowLeft,
    User,
    Trash2,
    Pencil,
    Save,
    Loader2,
    Calendar,
    Building2,
    Mail,
    Hash,
    Check,
    X,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { ObjectGraph } from '@/components/data';
import type { Worker, GlobalEdge, Organization } from '@/lib/types/objects';
import { updateWorkerAction, deleteWorkerAction } from '../../actions';

interface WorkerDetailPageProps {
    worker: Worker;
    edges: GlobalEdge[];
    organizations: Organization[];
}

export function WorkerDetailPage({ worker, edges, organizations }: WorkerDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [fullName, setFullName] = useState(worker.full_name);
    const [email, setEmail] = useState(worker.email || '');
    const [workerId, setWorkerId] = useState(worker.worker_id || '');
    const [isActive, setIsActive] = useState(worker.is_active);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    const orgName = organizations.find((o) => o.oid === worker.org_oid)?.name || 'Unknown';
    const filteredEdges = edgeFilter ? edges.filter((e) => e.edge_type === edgeFilter) : edges;

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('full_name', fullName);
            formData.set('email', email);
            formData.set('worker_id', workerId);
            formData.set('is_active', String(isActive));
            await updateWorkerAction(worker.oid, formData);
            setIsEditing(false);
            router.refresh();
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('workers.deleteConfirm'))) return;
        setIsPending(true);
        try {
            await deleteWorkerAction(worker.oid);
            router.push('/data/workers');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setFullName(worker.full_name);
        setEmail(worker.email || '');
        setWorkerId(worker.worker_id || '');
        setIsActive(worker.is_active);
        setIsEditing(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/data/workers')}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                        >
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                                <User className="w-5 h-5" />
                            </div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('workers.detail')}</h1>
                        </div>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                        >
                            <Pencil className="w-4 h-4" />
                            <span>{t('common.edit')}</span>
                        </button>
                    )}
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Full Name */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('workers.fullName')}</label>
                        {isEditing ? (
                            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`} />
                        ) : (
                            <div className={`px-3 py-2 rounded-lg text-lg ${isLight ? 'text-slate-800 bg-slate-50' : 'text-white bg-white/5'}`}>{worker.full_name}</div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Email */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('workers.email')}</label>
                            {isEditing ? (
                                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('workers.notSet')} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`} />
                            ) : (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    <Mail className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                    <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{worker.email || t('workers.notSet')}</span>
                                </div>
                            )}
                        </div>

                        {/* Worker ID */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('workers.workerId')}</label>
                            {isEditing ? (
                                <input type="text" value={workerId} onChange={(e) => setWorkerId(e.target.value)} placeholder={t('workers.notSet')} className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`} />
                            ) : (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    <Hash className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                    <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{worker.worker_id || t('workers.notSet')}</span>
                                </div>
                            )}
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

                        {/* Status */}
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('workers.status')}</label>
                            {isEditing ? (
                                <label className="flex items-center gap-2 px-3 py-2">
                                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4" />
                                    <span className={isLight ? 'text-slate-700' : 'text-gray-300'}>{t('workers.active')}</span>
                                </label>
                            ) : (
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    {worker.is_active ? (
                                        <span className="flex items-center gap-1 text-green-500"><Check className="w-4 h-4" /> {t('workers.active')}</span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-red-500"><X className="w-4 h-4" /> {t('workers.inactive')}</span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('common.created')}</label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Calendar className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{new Date(worker.created_at).toLocaleString()}</span>
                            </div>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('common.updated')}</label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Calendar className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{new Date(worker.updated_at).toLocaleString()}</span>
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
                                <span>{t('common.delete')} {t('workers.title')}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('common.edgeRelationships')}</h2>
                    <ObjectGraph
                        oid={worker.oid}
                        objectType="worker"
                        descriptor={worker.full_name}
                        edges={filteredEdges}
                        onFilterChange={setEdgeFilter}
                        selectedFilter={edgeFilter}
                    />
                </div>
            </div>
        </div>
    );
}
