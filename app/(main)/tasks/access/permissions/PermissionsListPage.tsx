'use client';

/**
 * Permissions list page with navigation to detail and create pages.
 */

import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import { Plus, Lock } from 'lucide-react';
import type { Permission } from '@/lib/types/security';

interface PermissionsListPageProps {
    permissions: Permission[];
}

export function PermissionsListPage({ permissions }: PermissionsListPageProps) {
    const t = useTranslations('Auth');
    const router = useTransitionRouter();

    const handleRowClick = (permission: Permission) => {
        router.push(`/tasks/access/permissions/${permission.oid}`);
    };

    const handleCreateClick = () => {
        router.push('/tasks/access/permissions/new');
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="h-full glass-card rounded-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-line flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-accent" />
                        <h1 className="text-xl font-semibold text-ink">{t('permissions.title')}</h1>
                    </div>
                    <button
                        onClick={handleCreateClick}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-accent transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">{t('common.create')}</span>
                    </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {permissions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted">
                            <Lock className="w-12 h-12 mb-4 opacity-50" />
                            <p>{t('permissions.empty')}</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="sticky top-0 bg-inherit">
                                <tr className="text-left text-sm text-ink-2 border-b border-line">
                                    <th className="px-4 py-3 font-medium">{t('permissions.code')}</th>
                                    <th className="px-4 py-3 font-medium">{t('permissions.domain')}</th>
                                    <th className="px-4 py-3 font-medium">{t('permissions.resource')}</th>
                                    <th className="px-4 py-3 font-medium">{t('permissions.action')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {permissions.map((permission) => (
                                    <tr
                                        key={permission.oid}
                                        onClick={() => handleRowClick(permission)}
                                        className="hover:bg-hover cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-sm text-accent">
                                                {permission.permission_code}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-ink">{permission.domain}</td>
                                        <td className="px-4 py-3 text-ink">{permission.resource}</td>
                                        <td className="px-4 py-3 text-ink">{permission.action}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
