'use client';

/**
 * Permissions list page with navigation to detail and create pages.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Lock } from 'lucide-react';
import type { Permission } from '@/lib/types/security';

interface PermissionsListPageProps {
    permissions: Permission[];
}

export function PermissionsListPage({ permissions }: PermissionsListPageProps) {
    const t = useTranslations('Security');
    const router = useRouter();

    const handleRowClick = (permission: Permission) => {
        router.push(`/security/permissions/${permission.oid}`);
    };

    const handleCreateClick = () => {
        router.push('/security/permissions/new');
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="h-full glass-card rounded-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Lock className="w-5 h-5 text-blue-400" />
                        <h1 className="text-xl font-semibold text-white">{t('permissions.title')}</h1>
                    </div>
                    <button
                        onClick={handleCreateClick}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">{t('common.create')}</span>
                    </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    {permissions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <Lock className="w-12 h-12 mb-4 opacity-50" />
                            <p>{t('permissions.empty')}</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="sticky top-0 bg-inherit">
                                <tr className="text-left text-sm text-gray-400 border-b border-white/10">
                                    <th className="px-4 py-3 font-medium">{t('permissions.code')}</th>
                                    <th className="px-4 py-3 font-medium">{t('permissions.domain')}</th>
                                    <th className="px-4 py-3 font-medium">{t('permissions.resource')}</th>
                                    <th className="px-4 py-3 font-medium">{t('permissions.action')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {permissions.map((permission) => (
                                    <tr
                                        key={permission.oid}
                                        onClick={() => handleRowClick(permission)}
                                        className="hover:bg-white/5 cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-sm text-blue-400">
                                                {permission.permission_code}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-white">{permission.domain}</td>
                                        <td className="px-4 py-3 text-white">{permission.resource}</td>
                                        <td className="px-4 py-3 text-white">{permission.action}</td>
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
