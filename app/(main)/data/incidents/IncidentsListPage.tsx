'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus, RefreshCw, Search } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Incident } from '@/lib/types/objects';

interface IncidentsListPageProps {
    incidents: Incident[];
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-500' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-500' },
    medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
    low: { bg: 'bg-green-500/20', text: 'text-green-500' },
    none: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
};

export function IncidentsListPage({ incidents }: IncidentsListPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredIncidents = incidents.filter((incident) => {
        return searchQuery === '' || incident.title.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.refresh();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const getPriorityStyle = (priority: string | null) => PRIORITY_COLORS[priority?.toLowerCase() || 'none'] || PRIORITY_COLORS.none;

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400'}`}>
                            <AlertCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Incidents</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {incidents.length} Total
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleRefresh} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                        {/* New Incident Button - Optional, add if needed */}
                        {/* <button onClick={() => router.push('/data/incidents/new')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors">
                            <Plus className="w-4 h-4" />
                            <span>New Incident</span>
                        </button> */}
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
                            placeholder="Search incidents..."
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-red-500/50`}
                        />
                    </div>
                </div>

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {filteredIncidents.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No incidents found</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredIncidents.map((incident) => {
                                const style = getPriorityStyle(incident.priority);
                                return (
                                    <button
                                        key={incident.oid}
                                        onClick={() => router.push(`/data/incidents/${incident.oid}`)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{incident.title}</div>
                                            <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                {(incident.stable_id || '—')} • {incident.state}
                                            </div>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${style.bg} ${style.text}`}>
                                            {incident.priority || 'No Priority'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
