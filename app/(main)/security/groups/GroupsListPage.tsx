'use client';

/**
 * Groups list page with navigation to detail and create pages.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, Users } from 'lucide-react';
import type { Group } from '@/lib/types/security';

interface GroupsListPageProps {
    groups: Group[];
}

const scopeTypeColors: Record<string, string> = {
    unconstrained: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    self_scoped: 'bg-green-500/20 text-green-400 border-green-500/30',
    role_based: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export function GroupsListPage({ groups }: GroupsListPageProps) {
    const t = useTranslations('Security');
    const router = useRouter();

    const handleRowClick = (group: Group) => {
        router.push(`/security/groups/${group.oid}`);
    };

    const handleCreateClick = () => {
        router.push('/security/groups/new');
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="h-full glass-card rounded-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-blue-400" />
                        <h1 className="text-xl font-semibold text-white">{t('groups.title')}</h1>
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
                    {groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                            <Users className="w-12 h-12 mb-4 opacity-50" />
                            <p>{t('groups.empty')}</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="sticky top-0 bg-inherit">
                                <tr className="text-left text-sm text-gray-400 border-b border-white/10">
                                    <th className="px-4 py-3 font-medium">{t('groups.name')}</th>
                                    <th className="px-4 py-3 font-medium">{t('groups.scopeType')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {groups.map((group) => (
                                    <tr
                                        key={group.oid}
                                        onClick={() => handleRowClick(group)}
                                        className="hover:bg-white/5 cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-white">{group.name}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`px-2 py-1 rounded-md text-xs font-medium border ${scopeTypeColors[group.scope_type] || 'bg-gray-500/20 text-gray-400'
                                                    }`}
                                            >
                                                {t(`groups.scope.${group.scope_type}`)}
                                            </span>
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
