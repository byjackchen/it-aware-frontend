'use client';

/**
 * Permission detail page client component.
 */

import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Trash2, Loader2, Lock } from 'lucide-react';
import type { Permission, Group } from '@/lib/types/security';
import { deletePermission } from '@/app/actions/security';

interface PermissionDetailPageProps {
    permission: Permission;
    assignedGroups: Group[];
}

export function PermissionDetailPage({
    permission,
    assignedGroups,
}: PermissionDetailPageProps) {
    const t = useTranslations('Auth');
    const router = useTransitionRouter();
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        if (!confirm(t('common.deleteConfirm'))) return;
        startTransition(async () => {
            await deletePermission(permission.oid);
            router.push('/tasks/access/permissions');
        });
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button
                        onClick={() => router.push('/tasks/access/permissions')}
                        className="p-2 rounded-lg hover:bg-hover transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-ink-2" />
                    </button>
                    <div className="flex items-center gap-3">
                        <Lock className="w-6 h-6 text-accent" />
                        <h1 className="text-2xl font-semibold text-ink">{t('permissions.detail')}</h1>
                    </div>
                </div>

                {/* Content */}
                <div className="glass-card rounded-xl p-6 space-y-6">
                    {/* Permission Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-ink-2 mb-1">
                                {t('permissions.code')}
                            </label>
                            <div className="px-3 py-2 rounded-lg theme-input-readonly font-mono text-accent text-lg">
                                {permission.permission_code}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-ink-2 mb-1">
                                    {t('permissions.domain')}
                                </label>
                                <div className="px-3 py-2 rounded-lg theme-input-readonly text-ink">
                                    {permission.domain}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-ink-2 mb-1">
                                    {t('permissions.resource')}
                                </label>
                                <div className="px-3 py-2 rounded-lg theme-input-readonly text-ink">
                                    {permission.resource}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-ink-2 mb-1">
                                    {t('permissions.action')}
                                </label>
                                <div className="px-3 py-2 rounded-lg theme-input-readonly text-ink">
                                    {permission.action}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Assigned Groups */}
                    <div className="border-t border-line pt-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-2 mb-3">
                            {t('permissions.assignedGroups')}
                        </h3>
                        {assignedGroups.length === 0 ? (
                            <p className="text-sm text-muted">{t('permissions.noGroupsAssigned')}</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {assignedGroups.map((group) => (
                                    <span
                                        key={group.oid}
                                        className="px-3 py-1.5 rounded-lg theme-tag text-sm"
                                    >
                                        {group.name}
                                    </span>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-muted mt-2">
                            {t('permissions.manageGroupsHint')}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-line">
                        <button
                            onClick={handleDelete}
                            disabled={isPending}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-bad transition-colors disabled:opacity-50"
                        >
                            {isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                            <span>{t('common.delete')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
