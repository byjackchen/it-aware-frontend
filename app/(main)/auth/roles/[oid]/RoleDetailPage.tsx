'use client';

/**
 * Role detail page client component with edit functionality.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Trash2, Pencil, Loader2, Shield, Check, X, Save } from 'lucide-react';
import type { Role, Group } from '@/lib/types/security';
import { updateRole, deleteRole } from '@/app/actions/security';

interface RoleDetailPageProps {
    role: Role;
    linkedGroups: Group[];
}

export function RoleDetailPage({ role, linkedGroups }: RoleDetailPageProps) {
    const t = useTranslations('Auth');
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(role.name);
    const [includeDesc, setIncludeDesc] = useState(role.include_desc);

    const handleSave = () => {
        const formData = new FormData();
        formData.set('name', name);
        formData.set('include_desc', String(includeDesc));
        startTransition(async () => {
            await updateRole(role.oid, formData);
            setIsEditing(false);
            router.refresh();
        });
    };

    const handleDelete = () => {
        if (!confirm(t('common.deleteConfirm'))) return;
        startTransition(async () => {
            await deleteRole(role.oid);
            router.push('/auth/roles');
        });
    };

    const handleCancel = () => {
        setName(role.name);
        setIncludeDesc(role.include_desc);
        setIsEditing(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/auth/roles')}
                            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </button>
                        <div className="flex items-center gap-3">
                            <Shield className="w-6 h-6 text-blue-400" />
                            <h1 className="text-2xl font-semibold text-white">{t('roles.detail')}</h1>
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
                    {/* Role Info */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                {t('roles.name')}
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
                                    {role.name}
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">
                                {t('roles.includeDescendants')}
                            </label>
                            {isEditing ? (
                                <label className="flex items-center gap-3 px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={includeDesc}
                                        onChange={(e) => setIncludeDesc(e.target.checked)}
                                        className="w-5 h-5 rounded theme-checkbox"
                                    />
                                    <span className="text-white">{t('roles.includeDescHint')}</span>
                                </label>
                            ) : (
                                <div className="px-3 py-2 rounded-lg theme-input-readonly">
                                    {role.include_desc ? (
                                        <span className="flex items-center gap-1 text-green-400">
                                            <Check className="w-4 h-4" />
                                            <span>{t('roles.includeDescYes')}</span>
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-gray-400">
                                            <X className="w-4 h-4" />
                                            <span>{t('roles.includeDescNo')}</span>
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Linked Groups */}
                    <div className="border-t border-white/10 pt-6">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400 mb-3">
                            {t('roles.linkedGroups')}
                        </h3>
                        {linkedGroups.length === 0 ? (
                            <p className="text-sm text-gray-500">{t('roles.noGroupsLinked')}</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {linkedGroups.map((group) => (
                                    <span
                                        key={group.oid}
                                        className="px-3 py-1.5 rounded-lg theme-tag text-sm"
                                    >
                                        {group.name}
                                    </span>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                            {t('roles.manageGroupsHint')}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-white/10">
                        {isEditing ? (
                            <>
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
                            </>
                        ) : (
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
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
