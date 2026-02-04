'use client';

/**
 * Service Catalog detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowLeft,
    Layers,
    Trash2,
    Pencil,
    Save,
    Loader2,
    Calendar,
    GitBranch,
    Hash,
    CheckCircle,
    XCircle,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { ObjectGraph, RoleWorkerAssignment, HierarchySelect } from '@/components/data';
import { formatDateTime } from '@/lib/utils/datetime';
import type { ServiceCatalog, GlobalEdge, WorkerHierarchyRole, Worker } from '@/lib/types/objects';
import type { Role } from '@/lib/types/security';
import { updateServiceCatalogAction, deleteServiceCatalogAction, assignWorkerRoleAction, removeWorkerRoleAction } from '@/app/actions/objects';

interface ServiceCatalogDetailPageProps {
    serviceCatalog: ServiceCatalog;
    serviceCatalogs: ServiceCatalog[];
    edges: GlobalEdge[];
    assignments: WorkerHierarchyRole[];
    workers: Worker[];
    roles: Role[];
}

export function ServiceCatalogDetailPage({
    serviceCatalog,
    serviceCatalogs,
    edges,
    assignments,
    workers,
    roles,
}: ServiceCatalogDetailPageProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [name, setName] = useState(serviceCatalog.name);
    const [stableId, setStableId] = useState(serviceCatalog.stable_id || '');
    const [parentOid, setParentOid] = useState<string | null>(serviceCatalog.parent_oid);
    const [isActive, setIsActive] = useState(serviceCatalog.is_active);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    // Get parent name for display
    const parentName = serviceCatalog.parent_oid
        ? serviceCatalogs.find((s) => s.oid === serviceCatalog.parent_oid)?.name
        : null;

    const filteredEdges = edgeFilter ? edges.filter((e) => {
        const connectedObject = e.from_oid === serviceCatalog.oid ? e.to_object : e.from_object;
        return connectedObject?.object_type === edgeFilter;
    }) : edges;

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('name', name);
            formData.set('stable_id', stableId);
            formData.set('is_active', String(isActive));
            if (parentOid !== serviceCatalog.parent_oid) {
                formData.set('parent_oid', parentOid || '');
            }
            await updateServiceCatalogAction(serviceCatalog.oid, formData);
            setIsEditing(false);
            router.refresh();
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('serviceCatalogs.deleteConfirm'))) return;
        setIsPending(true);
        try {
            await deleteServiceCatalogAction(serviceCatalog.oid);
            router.push('/data/service-catalogs');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setName(serviceCatalog.name);
        setStableId(serviceCatalog.stable_id || '');
        setParentOid(serviceCatalog.parent_oid);
        setIsActive(serviceCatalog.is_active);
        setIsEditing(false);
    };

    const handleAssignRole = async (workerOid: string, roleOid: string) => {
        await assignWorkerRoleAction(workerOid, roleOid, serviceCatalog.oid);
    };

    const handleRemoveRole = async (workerOid: string, roleOid: string) => {
        await removeWorkerRoleAction(workerOid, roleOid, serviceCatalog.oid);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/data/service-catalogs')}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                        >
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}`}>
                                <Layers className="w-5 h-5" />
                            </div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {t('serviceCatalogs.detail')}
                            </h1>
                        </div>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-colors"
                        >
                            <Pencil className="w-4 h-4" />
                            <span>{t('common.edit')}</span>
                        </button>
                    )}

                    {/* Status Badge */}
                    {!isEditing && (
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${serviceCatalog.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {serviceCatalog.is_active ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                            {serviceCatalog.is_active ? 'Active' : 'Inactive'}
                        </div>
                    )}
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Name */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            {t('common.name')}
                        </label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className={`w-full px-3 py-2 rounded-lg text-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}`}
                            />
                        ) : (
                            <div className={`px-3 py-2 rounded-lg text-lg ${isLight ? 'text-slate-800 bg-slate-50' : 'text-white bg-white/5'}`}>
                                {serviceCatalog.name}
                            </div>
                        )}
                    </div>

                    {/* Stable ID */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            Stable ID
                        </label>
                        {isEditing ? (
                            <input
                                type="text"
                                value={stableId}
                                onChange={(e) => setStableId(e.target.value)}
                                placeholder="External identifier (optional)"
                                className={`w-full px-3 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800 placeholder:text-slate-400' : 'bg-white/10 text-white placeholder:text-gray-500'}`}
                            />
                        ) : (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Hash className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {serviceCatalog.stable_id || '—'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Parent */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            {t('common.parent')}
                        </label>
                        {isEditing ? (
                            <HierarchySelect
                                items={serviceCatalogs}
                                value={parentOid}
                                onChange={setParentOid}
                                excludeOid={serviceCatalog.oid}
                            />
                        ) : (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Layers className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {parentName || t('common.noParent')}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Path */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            {t('common.hierarchyPath')}
                        </label>
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                            <GitBranch className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                            <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                {serviceCatalog.path.length === 1
                                    ? t('common.levelsDeep', { count: serviceCatalog.path.length })
                                    : t('common.levelsDeepPlural', { count: serviceCatalog.path.length })}
                            </span>
                        </div>
                    </div>

                    {/* Status (Active/Inactive) */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            Status
                        </label>
                        {isEditing ? (
                            <button
                                type="button"
                                onClick={() => setIsActive(!isActive)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'}`}
                            >
                                {isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                <span className="text-sm font-medium">{isActive ? 'Active' : 'Inactive'}</span>
                            </button>
                        ) : (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                {serviceCatalog.is_active ? <CheckCircle className="w-4 h-4 text-green-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                                <span className={`text-sm ${serviceCatalog.is_active ? 'text-green-400' : 'text-red-400'}`}>
                                    {serviceCatalog.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                {t('common.created')}
                            </label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Calendar className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {formatDateTime(serviceCatalog.created_at, timezone)}
                                </span>
                            </div>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                {t('common.updated')}
                            </label>
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Calendar className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {formatDateTime(serviceCatalog.updated_at, timezone)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Edit Actions */}
                    {isEditing && (
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={handleSave}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-colors disabled:opacity-50"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>{t('common.save')}</span>
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={isPending}
                                className={`px-4 py-2 rounded-lg transition-colors ${isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-white/10 hover:bg-white/20 text-gray-300'}`}
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    )}

                    {/* Delete */}
                    {!isEditing && (
                        <div className={`pt-4 border-t ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                            <button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                <span>{t('common.delete')} {t('serviceCatalogs.title')}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Role Assignments */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {t('common.roleAssignments')}
                    </h2>
                    <RoleWorkerAssignment
                        hierarchyOid={serviceCatalog.oid}
                        roles={roles}
                        workers={workers}
                        assignments={assignments}
                        onAssign={handleAssignRole}
                        onRemove={handleRemoveRole}
                    />
                </div>

                {/* Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {t('common.edgeRelationships')}
                    </h2>
                    <ObjectGraph
                        oid={serviceCatalog.oid}
                        objectType="service_catalog"
                        descriptor={serviceCatalog.name}
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
