'use client';

/**
 * Workers list page client component.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, RefreshCw, Search, Check, X } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Worker, Organization } from '@/lib/types/objects';

interface WorkersListPageProps {
    workers: Worker[];
    organizations: Organization[];
}

export function WorkersListPage({ workers, organizations }: WorkersListPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState<boolean | null>(null);

    const orgMap = new Map(organizations.map((o) => [o.oid, o.name]));

    const filteredWorkers = workers.filter((w) => {
        const matchesSearch =
            searchQuery === '' ||
            w.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (w.email && w.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (w.worker_id && w.worker_id.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesActive = activeFilter === null || w.is_active === activeFilter;

        return matchesSearch && matchesActive;
    });

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.refresh();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}
            `}>
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                Workers
                            </h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {filteredWorkers.length} of {workers.length} worker{workers.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}
                        >
                            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => router.push('/data/workers/new')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Worker</span>
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search workers..."
                            className={`
                w-full pl-10 pr-4 py-2 rounded-lg
                ${isLight ? 'bg-slate-100 text-slate-800 placeholder-slate-400' : 'bg-white/10 text-white placeholder-gray-500'}
                focus:outline-none focus:ring-2 focus:ring-blue-500/50
              `}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setActiveFilter(null)}
                            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeFilter === null ? 'bg-blue-500 text-white' : isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-400'}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setActiveFilter(true)}
                            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeFilter === true ? 'bg-green-500 text-white' : isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-400'}`}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => setActiveFilter(false)}
                            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeFilter === false ? 'bg-red-500 text-white' : isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-400'}`}
                        >
                            Inactive
                        </button>
                    </div>
                </div>

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {filteredWorkers.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            No workers found
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredWorkers.map((worker) => (
                                <button
                                    key={worker.oid}
                                    onClick={() => router.push(`/data/workers/${worker.oid}`)}
                                    className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                      ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}
                    `}>
                                            {worker.full_name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                {worker.full_name}
                                            </div>
                                            <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                {worker.email || worker.worker_id || 'No email'}
                                                {' • '}
                                                {orgMap.get(worker.org_oid) || 'Unknown org'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {worker.is_active ? (
                                            <span className="flex items-center gap-1 text-xs text-green-500">
                                                <Check className="w-3 h-3" /> Active
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs text-red-500">
                                                <X className="w-3 h-3" /> Inactive
                                            </span>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
