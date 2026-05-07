'use client';

/**
 * Roles list page with navigation to detail and create pages.
 */

import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import { Plus, Shield, Check, X } from 'lucide-react';
import type { Role } from '@/lib/types/security';

interface RolesListPageProps {
    roles: Role[];
}

export function RolesListPage({ roles }: RolesListPageProps) {
    const t = useTranslations('Auth');
    const router = useTransitionRouter();

    const handleRowClick = (role: Role) => {
        router.push(`/auth/roles/${role.oid}`);
    };

    const handleCreateClick = () => {
        router.push('/auth/roles/new');
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="h-full glass-card rounded-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield className="w-5 h-5 text-blue-400" />
                        <h1 className="text-xl font-semibold text-white">{t('roles.title')}</h1>
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
                    {roles.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <Shield className="w-12 h-12 mb-4 opacity-50" />
                            <p>{t('roles.empty')}</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="sticky top-0 bg-inherit">
                                <tr className="text-left text-sm text-gray-400 border-b border-white/10">
                                    <th className="px-4 py-3 font-medium">{t('roles.name')}</th>
                                    <th className="px-4 py-3 font-medium">{t('roles.includeDescendants')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {roles.map((role) => (
                                    <tr
                                        key={role.oid}
                                        onClick={() => handleRowClick(role)}
                                        className="hover:bg-white/5 cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-white">{role.name}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {role.include_desc ? (
                                                <span className="flex items-center gap-1 text-green-400">
                                                    <Check className="w-4 h-4" />
                                                    <span className="text-sm">{t('common.yes')}</span>
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-gray-400">
                                                    <X className="w-4 h-4" />
                                                    <span className="text-sm">{t('common.no')}</span>
                                                </span>
                                            )}
                                        </td>
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
