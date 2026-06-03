'use client';

/**
 * Searchable dialog for selecting systems to link to accounts.
 * Filters out systems already linked to accounts. Mirrors WorkerSearchDialog.
 */

import { useState, useMemo } from 'react';
import { Search, X, Cpu } from 'lucide-react';
import type { System } from '@/lib/types/objects';

interface SystemSearchDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (system: System) => void;
    systems: System[];
    linkedSystemOids: string[];
}

export function SystemSearchDialog({
    isOpen,
    onClose,
    onSelect,
    systems,
    linkedSystemOids,
}: SystemSearchDialogProps) {
    const [searchTerm, setSearchTerm] = useState('');

    const availableSystems = useMemo(() => {
        const linkedSet = new Set(linkedSystemOids);
        return systems.filter((system) => {
            if (linkedSet.has(system.oid)) return false;
            if (!searchTerm) return true;
            const search = searchTerm.toLowerCase();
            return (
                system.name.toLowerCase().includes(search) ||
                system.system_id.toLowerCase().includes(search) ||
                system.system_platform.toLowerCase().includes(search)
            );
        });
    }, [systems, linkedSystemOids, searchTerm]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg mx-4 glass-dark rounded-xl shadow-2xl border border-white/10 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Select System</h3>
                    <button
                        onClick={onClose}
                        className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-4 border-b border-white/10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, system_id, or platform..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg theme-input text-sm"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                    {availableSystems.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            {searchTerm ? 'No systems match your search' : 'No available systems'}
                        </div>
                    ) : (
                        <ul className="divide-y divide-white/5">
                            {availableSystems.map((system) => (
                                <li key={system.oid}>
                                    <button
                                        onClick={() => {
                                            onSelect(system);
                                            onClose();
                                        }}
                                        className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors text-left ${!system.is_active ? 'opacity-60' : ''
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${system.is_active ? 'bg-cyan-500/20' : 'bg-gray-500/20'
                                            }`}>
                                            <Cpu className={`w-5 h-5 ${system.is_active ? 'text-cyan-400' : 'text-gray-400'
                                                }`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-medium truncate ${system.is_active ? 'text-white' : 'text-gray-400'
                                                    }`}>
                                                    {system.name}
                                                </span>
                                                {!system.is_active && (
                                                    <span className="px-1.5 py-0.5 text-xs rounded bg-gray-600/50 text-gray-400">
                                                        Inactive
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-sm text-gray-400 truncate">
                                                {system.system_id} · {system.system_platform}
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
