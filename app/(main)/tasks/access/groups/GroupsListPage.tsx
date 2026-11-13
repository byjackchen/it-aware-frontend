'use client';

/**
 * Groups list page with navigation to detail and create pages.
 */

import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import { Plus, Users } from 'lucide-react';
import type { Group } from '@/lib/types/security';

interface GroupsListPageProps {
    groups: Group[];
}

const scopeTypeColors: Record<string, string> = {
    unconstrained: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    self_scoped: 'bg-green-500/20 text-good border-green-500/30',
    role_based: 'bg-blue-500/20 text-accent border-blue-500/30',
};

export function GroupsListPage({ groups }: GroupsListPageProps) {
    const t = useTranslations('Auth');
    const router = useTransitionRouter();

    const handleRowClick = (group: Group) => {
        router.push(`/tasks/access/groups/${group.oid}`);
    };

    const handleCreateClick = () => {
        router.push('/tasks/access/groups/new');
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="h-full glass-card rounded-xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-line flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Users className="w-5 h-5 text-accent" />
                        <h1 className="text-xl font-semibold text-ink">{t('groups.title')}</h1>
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
                    {groups.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-muted">
                            <Users className="w-12 h-12 mb-4 opacity-50" />
                            <p>{t('groups.empty')}</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="sticky top-0 bg-inherit">
                                <tr className="text-left text-sm text-ink-2 border-b border-line">
                                    <th className="px-4 py-3 font-medium">{t('groups.name')}</th>
                                    <th className="px-4 py-3 font-medium">{t('groups.scopeType')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-line">
                                {groups.map((group) => (
                                    <tr
                                        key={group.oid}
                                        onClick={() => handleRowClick(group)}
                                        className="hover:bg-hover cursor-pointer transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <span className="font-medium text-ink">{group.name}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`px-2 py-1 rounded-md text-xs font-medium border ${scopeTypeColors[group.scope_type] || 'bg-gray-500/20 text-ink-2'
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
