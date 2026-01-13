'use client';

/**
 * Worker Selector Component for Persona Page
 * 
 * Allows users to search and select a worker to view their persona profile.
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/contexts/theme-context';
import { ChevronDown, Search, User } from 'lucide-react';
import type { Worker } from '@/lib/types/objects';
import { getWorkerFullName } from '@/lib/types/objects';

interface WorkerSelectorProps {
    workers: Worker[];
    currentWorkerOid: string;
}

export function WorkerSelector({ workers, currentWorkerOid }: WorkerSelectorProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentWorker = workers.find(w => w.oid === currentWorkerOid);

    const filteredWorkers = workers.filter(w => {
        const fullName = getWorkerFullName(w).toLowerCase();
        const email = (w.email || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        return fullName.includes(query) || email.includes(query);
    });

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (workerOid: string) => {
        setIsOpen(false);
        setSearchQuery('');
        router.push(`/persona/${workerOid}`);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                    ${isLight
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-white/10 hover:bg-white/20 text-gray-300'}
                `}
            >
                <span>Switch Profile</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className={`
                    absolute top-full right-0 mt-2 w-80 rounded-xl border shadow-xl z-50
                    ${isLight
                        ? 'bg-white border-slate-200'
                        : 'bg-[#1a1a2e] border-white/10'}
                `}>
                    {/* Search */}
                    <div className={`p-3 border-b ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                        <div className="relative">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search workers..."
                                autoFocus
                                className={`
                                    w-full pl-9 pr-3 py-2 rounded-lg text-sm
                                    ${isLight
                                        ? 'bg-slate-100 text-slate-800 placeholder-slate-400'
                                        : 'bg-white/10 text-white placeholder-gray-500'}
                                    focus:outline-none focus:ring-2 focus:ring-blue-500/50
                                `}
                            />
                        </div>
                    </div>

                    {/* Worker List */}
                    <div className="max-h-64 overflow-y-auto p-2">
                        {filteredWorkers.length === 0 ? (
                            <div className={`px-3 py-4 text-center text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                No workers found
                            </div>
                        ) : (
                            filteredWorkers.map(worker => {
                                const isSelected = worker.oid === currentWorkerOid;
                                return (
                                    <button
                                        key={worker.oid}
                                        onClick={() => handleSelect(worker.oid)}
                                        className={`
                                            w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                                            ${isSelected
                                                ? (isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-500/20 text-blue-300')
                                                : (isLight ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-white/5 text-gray-300')}
                                        `}
                                    >
                                        {/* Avatar */}
                                        <div className={`
                                            w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0
                                            ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-300'}
                                        `}>
                                            {getWorkerFullName(worker).split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{getWorkerFullName(worker)}</div>
                                            <div className={`text-xs truncate ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                                {worker.email || worker.professional_level || 'No email'}
                                            </div>
                                        </div>
                                        {isSelected && (
                                            <div className={`text-xs px-2 py-0.5 rounded ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/30 text-blue-300'}`}>
                                                Current
                                            </div>
                                        )}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
