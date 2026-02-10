'use client';

/**
 * Worker Selector Component for Persona Page
 *
 * Loads large worker list lazily when users open the selector.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/contexts/theme-context';
import { useLazyResourceList } from '@/lib/hooks/useLazyResourceList';
import { ChevronDown, Search } from 'lucide-react';
import type { Worker } from '@/lib/types/objects';

interface WorkerSelectorProps {
    currentWorker: Worker;
}

export function WorkerSelector({ currentWorker }: WorkerSelectorProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    const {
        items: loadedWorkers,
        isLoading,
        error,
        hasLoaded,
        load,
    } = useLazyResourceList<Worker>('workers', {
        query: {
            limit: 1000,
            is_active: true,
        },
    });

    const workers = useMemo(() => {
        const byOid = new Map<string, Worker>();
        byOid.set(currentWorker.oid, currentWorker);
        loadedWorkers.forEach((worker) => {
            byOid.set(worker.oid, worker);
        });
        return Array.from(byOid.values());
    }, [currentWorker, loadedWorkers]);

    const filteredWorkers = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return workers;

        return workers.filter((worker) => {
            const fullName = worker.fullname.toLowerCase();
            const email = (worker.email || '').toLowerCase();
            return fullName.includes(query) || email.includes(query);
        });
    }, [searchQuery, workers]);

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

    // Lazy load worker list only when the selector is opened.
    useEffect(() => {
        if (isOpen && !hasLoaded && !isLoading) {
            void load().catch(() => {
                // Error is displayed by state below.
            });
        }
    }, [hasLoaded, isLoading, isOpen, load]);

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
                        {!hasLoaded && isLoading ? (
                            <div className={`px-3 py-4 text-center text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                Loading workers...
                            </div>
                        ) : error ? (
                            <div className={`px-3 py-4 text-center text-sm ${isLight ? 'text-red-500' : 'text-red-400'}`}>
                                Failed to load workers
                            </div>
                        ) : filteredWorkers.length === 0 ? (
                            <div className={`px-3 py-4 text-center text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                No workers found
                            </div>
                        ) : (
                            filteredWorkers.map((worker) => {
                                const isSelected = worker.oid === currentWorker.oid;
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
                                            {worker.fullname.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium truncate">{worker.fullname}</div>
                                            <div className={`text-xs truncate ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                                {worker.email || worker.job_title || 'No email'}
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
