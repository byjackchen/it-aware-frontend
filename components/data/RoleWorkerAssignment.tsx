'use client';

/**
 * Component for managing worker-role assignments at a hierarchy node.
 * Allows assigning/removing workers to roles at organizations or locations.
 * 
 * Features:
 * - Compact worker tags (chips)
 * - Roles with assignments shown by default
 * - Roles without assignments hidden, searchable at bottom
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Plus, X, User, Loader2, Search, Shield } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Role } from '@/lib/types/security';
import type { Worker, WorkerHierarchyRole } from '@/lib/types/objects';
import { getWorkerFullName } from '@/lib/types/objects';

interface RoleWithWorkers {
    role: Role;
    workers: Worker[];
}

interface RoleWorkerAssignmentProps {
    hierarchyOid: string;
    roles: Role[];
    workers: Worker[];
    assignments: WorkerHierarchyRole[];
    onAssign: (workerOid: string, roleOid: string) => Promise<void>;
    onRemove: (workerOid: string, roleOid: string) => Promise<void>;
}

export function RoleWorkerAssignment({
    hierarchyOid,
    roles,
    workers,
    assignments,
    onAssign,
    onRemove,
}: RoleWorkerAssignmentProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [isPending, startTransition] = useTransition();
    const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
    const [addingToRole, setAddingToRole] = useState<string | null>(null);
    const [workerSearchQuery, setWorkerSearchQuery] = useState('');
    const [roleSearchQuery, setRoleSearchQuery] = useState('');

    // Build role-to-workers mapping
    const roleWorkerMap = new Map<string, Worker[]>();
    roles.forEach((role) => {
        roleWorkerMap.set(role.oid, []);
    });

    assignments
        .filter((a) => a.hierarchy_oid === hierarchyOid)
        .forEach((assignment) => {
            const worker = workers.find((w) => w.oid === assignment.worker_oid);
            if (worker) {
                const current = roleWorkerMap.get(assignment.role_oid) || [];
                roleWorkerMap.set(assignment.role_oid, [...current, worker]);
            }
        });

    const rolesWithWorkers: RoleWithWorkers[] = roles.map((role) => ({
        role,
        workers: roleWorkerMap.get(role.oid) || [],
    }));

    // Separate roles with/without assignments
    const rolesWithAssignments = rolesWithWorkers.filter((r) => r.workers.length > 0);
    const rolesWithoutAssignments = rolesWithWorkers.filter((r) => r.workers.length === 0);

    // Filter empty roles by search
    const filteredEmptyRoles = rolesWithoutAssignments.filter((r) =>
        roleSearchQuery === '' ||
        r.role.name.toLowerCase().includes(roleSearchQuery.toLowerCase())
    );

    // Get available workers (not already assigned to this role)
    const getAvailableWorkers = (roleOid: string) => {
        const assignedOids = new Set(
            assignments
                .filter((a) => a.hierarchy_oid === hierarchyOid && a.role_oid === roleOid)
                .map((a) => a.worker_oid)
        );
        return workers
            .filter((w) => !assignedOids.has(w.oid) && w.is_active)
            .filter((w) => {
                const fullName = getWorkerFullName(w);
                return workerSearchQuery === '' ||
                    fullName.toLowerCase().includes(workerSearchQuery.toLowerCase()) ||
                    (w.email && w.email.toLowerCase().includes(workerSearchQuery.toLowerCase()));
            });
    };

    const toggleRole = (roleOid: string) => {
        const next = new Set(expandedRoles);
        if (next.has(roleOid)) {
            next.delete(roleOid);
        } else {
            next.add(roleOid);
        }
        setExpandedRoles(next);
    };

    const handleAssign = (workerOid: string, roleOid: string) => {
        startTransition(async () => {
            await onAssign(workerOid, roleOid);
            setAddingToRole(null);
            setWorkerSearchQuery('');
            router.refresh();
        });
    };

    const handleRemove = (workerOid: string, roleOid: string) => {
        startTransition(async () => {
            await onRemove(workerOid, roleOid);
            router.refresh();
        });
    };

    if (roles.length === 0) {
        return (
            <div className={`p-4 text-center rounded-lg ${isLight ? 'bg-slate-50 text-slate-500' : 'bg-white/5 text-gray-500'}`}>
                {t('roleAssignment.noRoles')}
            </div>
        );
    }

    const renderRoleSection = ({ role, workers: assignedWorkers }: RoleWithWorkers, showEmpty = false) => {
        const isExpanded = expandedRoles.has(role.oid);
        const isAdding = addingToRole === role.oid;
        const availableWorkers = getAvailableWorkers(role.oid);
        const hasWorkers = assignedWorkers.length > 0;

        return (
            <div
                key={role.oid}
                className={`rounded-lg border overflow-hidden transition-colors ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}
            >
                {/* Role Header */}
                <button
                    onClick={() => toggleRole(role.oid)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                >
                    <div className="flex items-center gap-2">
                        {isExpanded ? (
                            <ChevronDown className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        ) : (
                            <ChevronRight className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        )}
                        <span className={`font-medium text-sm ${isLight ? 'text-slate-800' : 'text-white'}`}>
                            {role.name}
                        </span>
                        {hasWorkers && (
                            <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-500">
                                {assignedWorkers.length}
                            </span>
                        )}
                    </div>
                    {!isExpanded && hasWorkers && (
                        <div className="flex items-center gap-1 flex-wrap justify-end max-w-[50%]">
                            {assignedWorkers.slice(0, 3).map((worker) => (
                                <span
                                    key={worker.oid}
                                    className={`text-xs px-2 py-0.5 rounded-full truncate max-w-24 ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-300'}`}
                                >
                                    {getWorkerFullName(worker).split(' ')[0]}
                                </span>
                            ))}
                            {assignedWorkers.length > 3 && (
                                <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                    +{assignedWorkers.length - 3}
                                </span>
                            )}
                        </div>
                    )}
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className={`px-3 pb-3 ${isLight ? 'border-t border-slate-100' : 'border-t border-white/5'}`}>
                        {/* Assigned Workers as Compact Tags */}
                        {hasWorkers && (
                            <div className="flex flex-wrap gap-1.5 pt-2">
                                {assignedWorkers.map((worker) => (
                                    <div
                                        key={worker.oid}
                                        className={`inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-full text-xs ${isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-gray-200'}`}
                                    >
                                        <User className="w-3 h-3" />
                                        <span className="max-w-28 truncate">{getWorkerFullName(worker)}</span>
                                        <button
                                            onClick={() => handleRemove(worker.oid, role.oid)}
                                            disabled={isPending}
                                            className={`p-0.5 rounded-full transition-colors ${isLight ? 'hover:bg-red-100 hover:text-red-500' : 'hover:bg-red-500/20 hover:text-red-400'} disabled:opacity-50`}
                                        >
                                            {isPending ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <X className="w-3 h-3" />
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Empty state for roles without workers */}
                        {!hasWorkers && !isAdding && (
                            <p className={`text-xs py-2 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {t('roleAssignment.noWorkers')}
                            </p>
                        )}

                        {/* Add Worker Section */}
                        {isAdding ? (
                            <div className="pt-2 space-y-2">
                                {/* Search Input */}
                                <div className="relative">
                                    <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                    <input
                                        type="text"
                                        value={workerSearchQuery}
                                        onChange={(e) => setWorkerSearchQuery(e.target.value)}
                                        placeholder={t('roleAssignment.searchWorkers')}
                                        className={`w-full pl-7 pr-3 py-1.5 text-xs rounded-md ${isLight ? 'bg-slate-100 text-slate-800 placeholder-slate-400' : 'bg-white/10 text-white placeholder-gray-500'} focus:outline-none focus:ring-1 focus:ring-blue-500/50`}
                                        autoFocus
                                    />
                                </div>

                                {/* Worker List */}
                                <div className={`max-h-36 overflow-y-auto rounded-md ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    {availableWorkers.length > 0 ? (
                                        availableWorkers.slice(0, 8).map((worker) => (
                                            <button
                                                key={worker.oid}
                                                onClick={() => handleAssign(worker.oid, role.oid)}
                                                disabled={isPending}
                                                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'} disabled:opacity-50`}
                                            >
                                                <User className={`w-3.5 h-3.5 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                                <span className={isLight ? 'text-slate-700' : 'text-gray-200'}>
                                                    {getWorkerFullName(worker)}
                                                </span>
                                                {worker.email && (
                                                    <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                                        ({worker.email})
                                                    </span>
                                                )}
                                            </button>
                                        ))
                                    ) : (
                                        <p className={`text-xs text-center py-3 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                            {t('roleAssignment.noAvailable')}
                                        </p>
                                    )}
                                </div>

                                {/* Cancel Button */}
                                <button
                                    onClick={() => {
                                        setAddingToRole(null);
                                        setWorkerSearchQuery('');
                                    }}
                                    className={`text-xs px-2 py-1 rounded-md transition-colors ${isLight ? 'text-slate-600 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}
                                >
                                    {t('common.cancel')}
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setAddingToRole(role.oid)}
                                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md transition-colors mt-2 ${isLight ? 'text-blue-600 hover:bg-blue-50' : 'text-blue-400 hover:bg-blue-500/10'}`}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                {t('roleAssignment.addWorker')}
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Roles with assignments */}
            {rolesWithAssignments.length > 0 && (
                <div className="space-y-2">
                    {rolesWithAssignments.map((roleData) => renderRoleSection(roleData))}
                </div>
            )}

            {/* Empty roles section */}
            {rolesWithoutAssignments.length > 0 && (
                <div className={`pt-3 ${rolesWithAssignments.length > 0 ? `border-t ${isLight ? 'border-slate-200' : 'border-white/10'}` : ''}`}>
                    {/* Section header with search */}
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <span className={`text-xs font-medium ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            {t('roleAssignment.unassignedRoles')} ({rolesWithoutAssignments.length})
                        </span>
                    </div>

                    {/* Search for empty roles */}
                    <div className="relative mb-2">
                        <Search className={`absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={roleSearchQuery}
                            onChange={(e) => setRoleSearchQuery(e.target.value)}
                            placeholder={t('roleAssignment.searchRoles')}
                            className={`w-full pl-7 pr-3 py-1.5 text-xs rounded-md ${isLight ? 'bg-slate-100 text-slate-800 placeholder-slate-400' : 'bg-white/10 text-white placeholder-gray-500'} focus:outline-none focus:ring-1 focus:ring-blue-500/50`}
                        />
                    </div>

                    {/* Filtered empty roles */}
                    {filteredEmptyRoles.length > 0 ? (
                        <div className="space-y-1.5">
                            {filteredEmptyRoles.slice(0, roleSearchQuery ? 10 : 5).map((roleData) => renderRoleSection(roleData, true))}
                            {!roleSearchQuery && filteredEmptyRoles.length > 5 && (
                                <p className={`text-xs text-center py-1 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                    {t('roleAssignment.moreRoles', { count: filteredEmptyRoles.length - 5 })}
                                </p>
                            )}
                        </div>
                    ) : (
                        <p className={`text-xs text-center py-2 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                            {t('roleAssignment.noMatchingRoles')}
                        </p>
                    )}
                </div>
            )}

            {/* No assignments at all message */}
            {rolesWithAssignments.length === 0 && rolesWithoutAssignments.length > 0 && (
                <p className={`text-xs text-center py-2 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                    {t('roleAssignment.noAssignments')}
                </p>
            )}
        </div>
    );
}
