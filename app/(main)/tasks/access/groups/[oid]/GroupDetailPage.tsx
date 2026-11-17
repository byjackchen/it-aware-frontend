'use client';

/**
 * Group detail page client component with edit and assignment management.
 */

import { useState, useTransition } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Trash2, Pencil, Loader2, Users, Save } from 'lucide-react';
import { AssignmentManager } from '@/components/security';
import type { Group, Permission, Role, ScopeType } from '@/lib/types/security';
import { SCOPE_TYPES } from '@/lib/types/security';
import type { Task } from '@/lib/types/tasks';
import { HomeTasksCard } from './HomeTasksCard';
import {
    updateGroup,
    deleteGroup,
    assignGroupPermission,
    removeGroupPermission,
    linkGroupRole,
    unlinkGroupRole,
} from '@/app/actions/security';

interface GroupDetailPageProps {
    group: Group;
    assignedPermissions: Permission[];
    allPermissions: Permission[];
    linkedRoles: Role[];
    allRoles: Role[];
    /** The catalog's tasks, for the home tasks; null when the admin may not read them. */
    tasks: Task[] | null;
}

const scopeTypeColors: Record<string, string> = {
    unconstrained: 'bg-purple-500/20 text-purple-800 dark:text-purple-400 border-purple-500/30',
    self_scoped: 'bg-green-500/20 text-green-800 dark:text-green-400 border-green-500/30',
    role_based: 'bg-blue-500/20 text-blue-800 dark:text-blue-400 border-blue-500/30',
};

export function GroupDetailPage({
    group,
    assignedPermissions,
    allPermissions,
    linkedRoles,
    allRoles,
    tasks,
}: GroupDetailPageProps) {
    const t = useTranslations('Auth');
    const router = useTransitionRouter();
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
            router.push('/tasks/access/groups');
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
                            onClick={() => router.push('/tasks/access/groups')}
                            className="p-2 rounded-lg hover:bg-hover transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-ink-2" />
                        </button>
                        <div className="flex items-center gap-3">
                            <Users className="w-6 h-6 text-accent" />
                            <h1 className="text-2xl font-semibold text-ink">{t('groups.detail')}</h1>
                        </div>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-btn-accent hover:bg-btn-accent-hover text-accent transition-colors"
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
                            <label className="block text-sm font-medium text-ink-2 mb-1">
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
                                <div className="px-3 py-2 rounded-lg theme-input-readonly text-ink text-lg">
                                    {group.name}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-ink-2 mb-1">
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
                                        className={`px-2 py-1 rounded-md text-xs font-medium border ${scopeTypeColors[group.scope_type] || 'bg-gray-500/20 text-ink-2'
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
                        <div className="pt-4 border-t border-line">
                            <button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-btn-danger hover:bg-btn-danger-hover text-bad transition-colors disabled:opacity-50"
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

                {tasks && (
                    <HomeTasksCard
                        groupOid={group.oid}
                        homeTasks={group.home_tasks}
                        tasks={tasks}
                    />
                )}
            </div>
        </div>
    );
}
