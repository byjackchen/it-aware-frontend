'use client';

/**
 * Organization detail page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowLeft,
    Building2,
    Trash2,
    Pencil,
    Save,
    Loader2,
    Calendar,
    GitBranch,
    Tag,
    Hash,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { ObjectGraph, RoleWorkerAssignment, HierarchySelect, OrganizationTypeSelect } from '@/components/data';
import type { Organization, OrganizationType, GlobalEdge, WorkerHierarchyRole, Worker } from '@/lib/types/objects';
import type { Role } from '@/lib/types/security';
import { updateOrganizationAction, deleteOrganizationAction, assignWorkerRoleAction, removeWorkerRoleAction } from '@/app/actions/objects';

interface OrganizationDetailPageProps {
    organization: Organization;
    organizations: Organization[];
    edges: GlobalEdge[];
    assignments: WorkerHierarchyRole[];
    workers: Worker[];
    roles: Role[];
}

export function OrganizationDetailPage({
    organization,
    organizations,
    edges,
    assignments,
    workers,
    roles,
}: OrganizationDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isEditing, setIsEditing] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [name, setName] = useState(organization.name);
    const [type, setType] = useState<OrganizationType>(organization.type);
    const [stableId, setStableId] = useState(organization.stable_id || '');
    const [parentOid, setParentOid] = useState<string | null>(organization.parent_oid);
    const [edgeFilter, setEdgeFilter] = useState<string | null>(null);

    // Get parent name for display
    const parentName = organization.parent_oid
        ? organizations.find((o) => o.oid === organization.parent_oid)?.name
        : null;

    const filteredEdges = edgeFilter
        ? edges.filter((e) => e.edge_type === edgeFilter)
        : edges;

    const handleSave = async () => {
        setIsPending(true);
        try {
            const formData = new FormData();
            formData.set('name', name);
            formData.set('type', type);
            formData.set('stable_id', stableId);
            if (parentOid !== organization.parent_oid) {
                formData.set('parent_oid', parentOid || '');
            }
            await updateOrganizationAction(organization.oid, formData);
            setIsEditing(false);
            router.refresh();
        } finally {
            setIsPending(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t('organizations.deleteConfirm'))) return;
        setIsPending(true);
        try {
            await deleteOrganizationAction(organization.oid);
            router.push('/data/organizations');
        } finally {
            setIsPending(false);
        }
    };

    const handleCancel = () => {
        setName(organization.name);
        setType(organization.type);
        setStableId(organization.stable_id || '');
        setParentOid(organization.parent_oid);
        setIsEditing(false);
    };

    const handleAssignRole = async (workerOid: string, roleOid: string) => {
        await assignWorkerRoleAction(workerOid, roleOid, organization.oid);
    };

    const handleRemoveRole = async (workerOid: string, roleOid: string) => {
        await removeWorkerRoleAction(workerOid, roleOid, organization.oid);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/data/organizations')}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}
                        >
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}`}>
                                <Building2 className="w-5 h-5" />
                            </div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {t('organizations.detail')}
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
                                {organization.name}
                            </div>
                        )}
                    </div>

                    {/* Type */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                            Type
                        </label>
                        {isEditing ? (
                            <OrganizationTypeSelect value={type} onChange={setType} />
                        ) : (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Tag className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                <span className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                    {organization.type}
                                </span>
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
                                    {organization.stable_id || '—'}
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
                                items={organizations}
                                value={parentOid}
                                onChange={setParentOid}
                                excludeOid={organization.oid}
                            />
                        ) : (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                <Building2 className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
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
                                {organization.path.length === 1
                                    ? t('common.levelsDeep', { count: organization.path.length })
                                    : t('common.levelsDeepPlural', { count: organization.path.length })}
                            </span>
                        </div>
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
                                    {new Date(organization.created_at).toLocaleString()}
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
                                    {new Date(organization.updated_at).toLocaleString()}
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
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
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
                                <span>{t('common.delete')} {t('organizations.title')}</span>
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
                        hierarchyOid={organization.oid}
                        roles={roles}
                        workers={workers}
                        assignments={assignments}
                        onAssign={handleAssignRole}
                        onRemove={handleRemoveRole}
                    />
                </div>

                {/* Relationships Graph */}
                <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {t('common.edgeRelationships')}
                    </h2>
                    <ObjectGraph
                        oid={organization.oid}
                        objectType="organization"
                        descriptor={organization.name}
                        edges={filteredEdges}
                        onFilterChange={setEdgeFilter}
                        selectedFilter={edgeFilter}
                    />
                </div>
            </div>
        </div>
    );
}
