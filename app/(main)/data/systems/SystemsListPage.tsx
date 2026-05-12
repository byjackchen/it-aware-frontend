'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { Cpu, Plus, RefreshCw, Search, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { Pagination } from '@/components/data/Pagination';
import type { System, SystemListResponse } from '@/lib/types/objects';

export function SystemsListPage() {
    const { theme } = useTheme();
    const router = useTransitionRouter();
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [remotePage, setRemotePage] = useState<{ page: number; items: System[] } | null>(null);
    const [isPageLoading, setIsPageLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    const {
        items: systems,
        total: totalSystems,
        isInitialLoading,
        error,
        reload,
    } = useInfiniteResource<System, SystemListResponse>('systems', {
        pageSize: 500,
        auto: true,
        extractItems: (response) => response.items,
        extractTotal: (response) => response.total,
        inferHasMore: () => false,
    });

    const filteredSystems = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return systems;
        return systems.filter((system) => (
            system.name.toLowerCase().includes(query)
            || system.system_id.toLowerCase().includes(query)
            || system.system_platform.toLowerCase().includes(query)
        ));
    }, [systems, searchQuery]);

    const isFiltering = searchQuery.trim().length > 0;

    const totalPages = Math.ceil(
        (isFiltering ? filteredSystems.length : (totalSystems ?? systems.length)) / pageSize
    ) || 1;

    const localStartIdx = (currentPage - 1) * pageSize;
    const isLocalPage = isFiltering || localStartIdx < filteredSystems.length;

    const displayedSystems = useMemo(() => {
        if (isLocalPage) {
            return filteredSystems.slice(localStartIdx, localStartIdx + pageSize);
        }
        if (remotePage?.page === currentPage) {
            return remotePage.items;
        }
        return [];
    }, [filteredSystems, localStartIdx, isLocalPage, remotePage, currentPage, pageSize]);

    const fetchRemotePage = useCallback((page: number) => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setIsPageLoading(true);
        const skip = (page - 1) * pageSize;
        fetch(`/api/objects/systems?skip=${skip}&limit=${pageSize}`, {
            cache: 'no-store',
            signal: controller.signal,
        })
            .then(res => res.json())
            .then((data: SystemListResponse) => {
                if (!controller.signal.aborted) {
                    setRemotePage({ page, items: data.items });
                    setIsPageLoading(false);
                }
            })
            .catch(e => {
                if (e instanceof DOMException && e.name === 'AbortError') return;
                setIsPageLoading(false);
            });
    }, [pageSize]);

    useEffect(() => {
        if (!isLocalPage && remotePage?.page !== currentPage && !isInitialLoading) {
            fetchRemotePage(currentPage);
        }
    }, [currentPage, isLocalPage, remotePage?.page, isInitialLoading, fetchRemotePage]);

    useEffect(() => { setCurrentPage(1); setRemotePage(null); }, [searchQuery, pageSize]);

    const handleRefresh = () => {
        setCurrentPage(1);
        setRemotePage(null);
        void reload();
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-cyan-100 text-cyan-600' : 'bg-cyan-500/20 text-cyan-400'}`}>
                            <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Systems</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {systems.length.toLocaleString()} cached / {(totalSystems ?? systems.length).toLocaleString()} total
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleRefresh} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${isInitialLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={() => router.push('/data/systems/new')} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white transition-colors">
                            <Plus className="w-4 h-4" />
                            <span>New System</span>
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by name, system ID, or platform..."
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-cyan-500/50`}
                        />
                    </div>
                </div>

                {/* Column Headers */}
                <div className={`rounded-t-xl border-x border-t px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold uppercase tracking-wide ${isLight ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-white/10 bg-white/5 text-gray-500'}`}>
                    <div className="col-span-4">Name</div>
                    <div className="col-span-2">System ID</div>
                    <div className="col-span-2">Platform</div>
                    <div className="col-span-3">Contact Worker</div>
                    <div className="col-span-1">Active</div>
                </div>

                {/* List */}
                <div className={`rounded-b-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {(isInitialLoading && systems.length === 0) || (isPageLoading && displayedSystems.length === 0) ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading systems...</span>
                        </div>
                    ) : error && systems.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : displayedSystems.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No systems found</div>
                    ) : (
                        <div className={`divide-y ${isLight ? 'divide-slate-100' : 'divide-white/5'}`}>
                            {displayedSystems.map((system) => (
                                <button
                                    key={system.oid}
                                    onClick={() => router.push(`/data/systems/${system.oid}`)}
                                    className={`w-full grid grid-cols-12 gap-2 items-center px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                >
                                    <div className={`col-span-4 font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                        {system.name}
                                    </div>
                                    <div className={`col-span-2 text-sm truncate ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                        {system.system_id}
                                    </div>
                                    <div className={`col-span-2 text-sm truncate ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                        {system.system_platform}
                                    </div>
                                    <div className={`col-span-3 text-sm truncate ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                        {system.contact_worker_oid || '—'}
                                    </div>
                                    <div className="col-span-1">
                                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${system.is_active
                                            ? (isLight ? 'bg-green-100 text-green-700' : 'bg-green-500/20 text-green-400')
                                            : (isLight ? 'bg-red-100 text-red-700' : 'bg-red-500/20 text-red-400')
                                        }`}>
                                            {system.is_active ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={isFiltering ? filteredSystems.length : (totalSystems ?? systems.length)}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                />
            </div>
        </div>
    );
}
