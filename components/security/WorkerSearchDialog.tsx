'use client';

/**
 * Searchable dialog for selecting workers to link to accounts.
 * Filters out workers already linked to accounts.
 */

import { useState, useMemo } from 'react';
import { Search, X, User } from 'lucide-react';
import type { Worker, AccountWorker } from '@/lib/types/security';

interface WorkerSearchDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (worker: Worker) => void;
    workers: Worker[];
    linkedWorkerOids: string[];
}

export function WorkerSearchDialog({
    isOpen,
    onClose,
    onSelect,
    workers,
    linkedWorkerOids,
}: WorkerSearchDialogProps) {
    const [searchTerm, setSearchTerm] = useState('');

    // Filter workers: not already linked, and matching search (inactive workers included)
    const availableWorkers = useMemo(() => {
        const linkedSet = new Set(linkedWorkerOids);
        return workers.filter((worker) => {
            // Exclude already linked workers
            if (linkedSet.has(worker.oid)) return false;
            if (!searchTerm) return true;

            const search = searchTerm.toLowerCase();
            return (
                worker.fullname.toLowerCase().includes(search) ||
                worker.email?.toLowerCase().includes(search) ||
                worker.worker_id?.toLowerCase().includes(search)
            );
        });
    }, [workers, linkedWorkerOids, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative w-full max-w-lg mx-4 glass-dark rounded-xl shadow-2xl border border-white/10 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Select Worker</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg theme-input text-sm"
                            autoFocus
                        />
                    </div>
                </div>

                {/* Worker List */}
                <div className="max-h-80 overflow-y-auto">
                    {availableWorkers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            {searchTerm ? 'No workers match your search' : 'No available workers'}
                        </div>
                    ) : (
                        <ul className="divide-y divide-white/5">
                            {availableWorkers.map((worker) => (
                                <li key={worker.oid}>
                                    <button
                                        onClick={() => {
                                            onSelect(worker);
                                            onClose();
                                        }}
                                        className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left ${!worker.is_active ? 'opacity-60' : ''
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${worker.is_active ? 'bg-blue-500/20' : 'bg-gray-500/20'
                                            }`}>
                                            <User className={`w-5 h-5 ${worker.is_active ? 'text-blue-400' : 'text-gray-400'
                                                }`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-medium truncate ${worker.is_active ? 'text-white' : 'text-gray-400'
                                                    }`}>
                                                    {worker.fullname}
                                                </span>
                                                {!worker.is_active && (
                                                    <span className="px-1.5 py-0.5 text-xs rounded bg-gray-600/50 text-gray-400">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-400 truncate">
                                                {worker.email || worker.worker_id || 'No email'}
                                            </div>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

