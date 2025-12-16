'use client';

/**
 * Component for managing worker-role assignments at a hierarchy node.
 * Allows assigning/removing workers to roles at organizations or locations.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronRight, Plus, X, User, Loader2, Search } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Role } from '@/lib/types/security';
import type { Worker, WorkerHierarchyRole } from '@/lib/types/objects';

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
    const isLight = theme === 'light';
    const [isPending, startTransition] = useTransition();
    const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set(roles.slice(0, 3).map(r => r.oid)));
    const [addingToRole, setAddingToRole] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

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

    // Get available workers (not already assigned to this role)
    const getAvailableWorkers = (roleOid: string) => {
        const assignedOids = new Set(
            assignments
                .filter((a) => a.hierarchy_oid === hierarchyOid && a.role_oid === roleOid)
                .map((a) => a.worker_oid)
        );
        return workers
            .filter((w) => !assignedOids.has(w.oid) && w.is_active)
            .filter((w) =>
                searchQuery === '' ||
                w.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (w.email && w.email.toLowerCase().includes(searchQuery.toLowerCase()))
            );
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
            setSearchQuery('');
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
            <div className={`
        p-4 text-center rounded-lg
        ${isLight ? 'bg-slate-50 text-slate-500' : 'bg-white/5 text-gray-500'}
      `}>
                No roles available. Create roles in the Security section first.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {rolesWithWorkers.map(({ role, workers: assignedWorkers }) => {
                const isExpanded = expandedRoles.has(role.oid);
                const isAdding = addingToRole === role.oid;
                const availableWorkers = getAvailableWorkers(role.oid);

                return (
                    <div
                        key={role.oid}
                        className={`
              rounded-lg border overflow-hidden transition-colors
              ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}
            `}
                    >
                        {/* Role Header */}
                        <button
                            onClick={() => toggleRole(role.oid)}
                            className={`
                w-full flex items-center justify-between px-4 py-3 text-left transition-colors
                ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}
              `}
                        >
                            <div className="flex items-center gap-3">
                                {isExpanded ? (
                                    <ChevronDown className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                ) : (
                                    <ChevronRight className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                )}
                                <span className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                    {role.name}
                                </span>
                            </div>
                            <span className={`
                text-xs px-2 py-0.5 rounded-full
                ${assignedWorkers.length > 0
                                    ? 'bg-blue-500/20 text-blue-500'
                                    : isLight
                                        ? 'bg-slate-100 text-slate-500'
                                        : 'bg-white/10 text-gray-500'
                                }
              `}>
                                {assignedWorkers.length} worker{assignedWorkers.length !== 1 ? 's' : ''}
                            </span>
                        </button>

                        {/* Expanded Content */}
                        {isExpanded && (
                            <div className={`
                px-4 pb-4 space-y-2
                ${isLight ? 'border-t border-slate-100' : 'border-t border-white/5'}
              `}>
                                {/* Assigned Workers */}
                                {assignedWorkers.length > 0 ? (
                                    <div className="space-y-1 pt-2">
                                        {assignedWorkers.map((worker) => (
                                            <div
                                                key={worker.oid}
                                                className={`
                          flex items-center justify-between px-3 py-2 rounded-lg
                          ${isLight ? 'bg-slate-50' : 'bg-white/5'}
                        `}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`
                            w-8 h-8 rounded-full flex items-center justify-center
                            ${isLight ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-gray-400'}
                          `}>
                                                        <User className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                                            {worker.full_name}
                                                        </div>
                                                        {worker.email && (
                                                            <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                                {worker.email}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleRemove(worker.oid, role.oid)}
                                                    disabled={isPending}
                                                    className={`
                            p-1.5 rounded-md transition-colors
                            ${isLight
                                                            ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                                                            : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                                                        }
                            disabled:opacity-50
                          `}
                                                >
                                                    {isPending ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <X className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className={`
                    text-sm py-2
                    ${isLight ? 'text-slate-500' : 'text-gray-500'}
                  `}>
                                        No workers assigned to this role.
                                    </p>
                                )}

                                {/* Add Worker Section */}
                                {isAdding ? (
                                    <div className="pt-2 space-y-2">
                                        {/* Search Input */}
                                        <div className="relative">
                                            <Search className={`
                        absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4
                        ${isLight ? 'text-slate-400' : 'text-gray-500'}
                      `} />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search workers..."
                                                className={`
                          w-full pl-9 pr-3 py-2 text-sm rounded-lg
                          ${isLight
                                                        ? 'bg-slate-100 text-slate-800 placeholder-slate-400'
                                                        : 'bg-white/10 text-white placeholder-gray-500'
                                                    }
                          focus:outline-none focus:ring-2 focus:ring-blue-500/50
                        `}
                                                autoFocus
                                            />
                                        </div>

                                        {/* Worker List */}
                                        <div className={`
                      max-h-48 overflow-y-auto rounded-lg
                      ${isLight ? 'bg-slate-50' : 'bg-white/5'}
                    `}>
                                            {availableWorkers.length > 0 ? (
                                                availableWorkers.slice(0, 10).map((worker) => (
                                                    <button
                                                        key={worker.oid}
                                                        onClick={() => handleAssign(worker.oid, role.oid)}
                                                        disabled={isPending}
                                                        className={`
                              w-full flex items-center gap-2 px-3 py-2 text-left transition-colors
                              ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5'}
                              disabled:opacity-50
                            `}
                                                    >
                                                        <User className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                                                        <div>
                                                            <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                                                {worker.full_name}
                                                            </div>
                                                            {worker.email && (
                                                                <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                                    {worker.email}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </button>
                                                ))
                                            ) : (
                                                <p className={`
                          text-sm text-center py-4
                          ${isLight ? 'text-slate-500' : 'text-gray-500'}
                        `}>
                                                    No workers available
                                                </p>
                                            )}
                                        </div>

                                        {/* Cancel Button */}
                                        <button
                                            onClick={() => {
                                                setAddingToRole(null);
                                                setSearchQuery('');
                                            }}
                                            className={`
                        text-sm px-3 py-1.5 rounded-md transition-colors
                        ${isLight
                                                    ? 'text-slate-600 hover:bg-slate-100'
                                                    : 'text-gray-400 hover:bg-white/10'
                                                }
                      `}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setAddingToRole(role.oid)}
                                        className={`
                      flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors mt-2
                      ${isLight
                                                ? 'text-blue-600 hover:bg-blue-50'
                                                : 'text-blue-400 hover:bg-blue-500/10'
                                            }
                    `}
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Worker
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
