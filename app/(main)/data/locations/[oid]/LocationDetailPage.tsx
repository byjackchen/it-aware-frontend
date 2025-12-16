'use client';

/**
 * Location detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowLeft,
    MapPin,
    Trash2,
    Pencil,
    Save,
    Loader2,
    Calendar,
    GitBranch,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { ObjectGraph, RoleWorkerAssignment } from '@/components/data';
import type { Location, GlobalEdge, WorkerHierarchyRole, Worker } from '@/lib/types/objects';
import type { Role } from '@/lib/types/security';
import { updateLocationAction, deleteLocationAction, assignWorkerRoleAction, removeWorkerRoleAction } from '../../actions';

interface LocationDetailPageProps {
    location: Location;
    edges: GlobalEdge[];
    assignments: WorkerHierarchyRole[];
    workers: Worker[];
    roles: Role[];
}

export function LocationDetailPage({
    location,
    edges,
    assignments,
    workers,
    roles,
}: LocationDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [name, setName] = useState(location.name);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    const filteredEdges = edgeFilter
        ? edges.filter((e) => e.edge_type === edgeFilter)
        : edges;

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('name', name);
            await updateLocationAction(location.oid, formData);
            setIsEditing(false);
            router.refresh();
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('locations.deleteConfirm'))) return;
        setIsPending(true);
        try {
            await deleteLocationAction(location.oid);
            router.push('/data/locations');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setName(location.name);
        setIsEditing(false);
    };

    const handleAssignRole = async (workerOid: string, roleOid: string) => {
        await assignWorkerRoleAction(workerOid, roleOid, location.oid);
    };

    const handleRemoveRole = async (workerOid: string, roleOid: string) => {
        await removeWorkerRoleAction(workerOid, roleOid, location.oid);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/data/locations')}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                        >
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`
                w-10 h-10 rounded-xl flex items-center justify-center
                ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}
              `}>
                                <MapPin className="w-5 h-5" />
                            </div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {t('locations.detail')}
                            </h1>
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
                    {/* Name */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('common.name')}</label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={`w-full px-3 py-2 rounded-lg text-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`}
                            />
                        ) : (
                            <div className={`px-3 py-2 rounded-lg text-lg ${isLight ? 'text-slate-800 bg-slate-50' : 'text-white bg-white/5'}`}>
                                {location.name}
                            </div>
                        )}
                    </div>

                    {/* Path */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('common.hierarchyPath')}</label>
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                            <GitBranch className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                            <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                {location.path.length === 1
                                    ? t('common.levelsDeep', { count: location.path.length })
                                    : t('common.levelsDeepPlural', { count: location.path.length })}
                            </span>
                        </div>
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('common.created')}</label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Calendar className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {new Date(location.created_at).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('common.updated')}</label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Calendar className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {new Date(location.updated_at).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {isEditing ? (
                        <div className="flex gap-3 pt-2">
                            <button onClick={handleSave} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>{t('common.save')}</span>
                            </button>
                            <button onClick={handleCancel} disabled={isPending} className={`px-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-300'}`}>
                                {t('common.cancel')}
                            </button>
                        </div>
                    ) : (
                        <div className={`pt-4 border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                            <button onClick={handleDelete} disabled={isPending} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                <span>{t('common.delete')} {t('locations.title')}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Role Assignments */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('common.roleAssignments')}</h2>
                    <RoleWorkerAssignment
                        hierarchyOid={location.oid}
                        roles={roles}
                        workers={workers}
                        assignments={assignments}
                        onAssign={handleAssignRole}
                        onRemove={handleRemoveRole}
                    />
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('common.edgeRelationships')}</h2>
                    <ObjectGraph
                        oid={location.oid}
                        objectType="location"
                        descriptor={location.name}
                        edges={filteredEdges}
                        onFilterChange={setEdgeFilter}
                        selectedFilter={edgeFilter}
                    />
                </div>
            </div>
        </div>
    );
}
