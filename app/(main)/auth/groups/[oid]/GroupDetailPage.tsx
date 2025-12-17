'use client';

/**
 * Group detail page client component with edit and assignment management.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Trash2, Pencil, Loader2, Users, Save } from 'lucide-react';
import { AssignmentManager } from '@/components/security';
import type { Group, Permission, Role, ScopeType } from '@/lib/types/security';
import { SCOPE_TYPES } from '@/lib/types/security';
import {
    updateGroup,
    deleteGroup,
    assignGroupPermission,
    removeGroupPermission,
    linkGroupRole,
    unlinkGroupRole,
} from '../../actions';

interface GroupDetailPageProps {
    group: Group;
    assignedPermissions: Permission[];
    allPermissions: Permission[];
    linkedRoles: Role[];
    allRoles: Role[];
}

const scopeTypeColors: Record<string, string> = {
    unconstrained: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    self_scoped: 'bg-green-500/20 text-green-400 border-green-500/30',
    role_based: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export function GroupDetailPage({
    group,
    assignedPermissions,
    allPermissions,
    linkedRoles,
    allRoles,
}: GroupDetailPageProps) {
    const t = useTranslations('Auth');
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(group.name);
    const [scopeType, setScopeType] = useState<ScopeType>(group.scope_type);

    const handleSave = () => {
        const formData = new FormData();
        formData.set('name', name);
        formData.set('scope_type', scopeType);
        startTransition(async () => {
            await updateGroup(group.oid, formData);
            setIsEditing(false);
            router.refresh();
        });
    };

    const handleDelete = () => {
        if (!confirm(t('common.deleteConfirm'))) return;
        startTransition(async () => {
            await deleteGroup(group.oid);
            router.push('/auth/groups');
        });
    };

    const handleCancel = () => {
        setName(group.name);
        setScopeType(group.scope_type);
        setIsEditing(false);
    };

    // Permission assignment handlers
    const handleAssignPermission = async (permissionOid: string) => {
        await assignGroupPermission(group.oid, permissionOid);
        router.refresh();
    };

    const handleRemovePermission = async (permissionOid: string) => {
        await removeGroupPermission(group.oid, permissionOid);
        router.refresh();
    };

    // Role link handlers
    const handleLinkRole = async (roleOid: string) => {
        await linkGroupRole(group.oid, roleOid);
        router.refresh();
    };

    const handleUnlinkRole = async (roleOid: string) => {
        await unlinkGroupRole(group.oid, roleOid);
        router.refresh();
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/auth/groups')}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </button>
                        <div className="flex items-center gap-3">
                            <Users className="w-6 h-6 text-blue-400" />
                            <h1 className="text-2xl font-semibold text-white">{t('groups.detail')}</h1>
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

                {/* Content */}
                <div className="glass-card rounded-xl p-6 space-y-6">
                    {/* Group Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                {t('groups.name')}
                            </label>
                            {isEditing ? (
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg theme-input"
                                />
                            ) : (
                                <div className="px-3 py-2 rounded-lg theme-input-readonly text-white text-lg">
                                    {group.name}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                {t('groups.scopeType')}
                            </label>
                            {isEditing ? (
                                <select
                                    value={scopeType}
                                    onChange={(e) => setScopeType(e.target.value as ScopeType)}
                                    className="w-full px-3 py-2 rounded-lg theme-select"
                                >
                                    {SCOPE_TYPES.map((st) => (
                                        <option key={st.value} value={st.value}>
                                            {t(`groups.scope.${st.value}`)}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <div className="px-3 py-2 rounded-lg theme-input-readonly">
                                    <span
                                        className={`px-2 py-1 rounded-md text-xs font-medium border ${scopeTypeColors[group.scope_type] || 'bg-gray-500/20 text-gray-400'
                                            }`}
                                    >
                                        {t(`groups.scope.${group.scope_type}`)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Edit Actions */}
                    {isEditing && (
                        <div className="flex gap-3">
                            <button
                                onClick={handleSave}
                                disabled={isPending || !name}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors disabled:opacity-50"
                            >
                                {isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                <span>{t('common.save')}</span>
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={isPending}
                                className="px-4 py-2 rounded-lg theme-btn-neutral"
                            >
                                {t('common.cancel')}
                            </button>
                        </div>
                    )}

                    {/* Permission Assignments */}
                    <AssignmentManager
                        title={t('permissions.title')}
                        assigned={assignedPermissions}
                        available={allPermissions}
                        getId={(p) => p.oid}
                        getLabel={(p) => p.permission_code}
                        onAssign={handleAssignPermission}
                        onRemove={handleRemovePermission}
                    />

                    {/* Role Links (only for role_based scope) */}
                    {group.scope_type === 'role_based' && (
                        <AssignmentManager
                            title={t('roles.title')}
                            assigned={linkedRoles}
                            available={allRoles}
                            getId={(r) => r.oid}
                            getLabel={(r) => r.name}
                            onAssign={handleLinkRole}
                            onRemove={handleUnlinkRole}
                        />
                    )}

                    {/* Delete Action */}
                    {!isEditing && (
                        <div className="pt-4 border-t border-white/10">
                            <button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50"
                            >
                                {isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                                <span>{t('common.delete')}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
