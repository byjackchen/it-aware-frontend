'use client';

/**
 * Service Catalogs list page client component with tree view and search.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Plus, RefreshCw, Search, X, ChevronsUpDown, ChevronsDownUp, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { HierarchyTree } from '@/components/data';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import { InfiniteLoadTrigger } from '@/components/data/InfiniteLoadTrigger';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { buildHierarchyTree } from '@/lib/utils/hierarchy';
import type { HierarchyTreeNode, ServiceCatalog } from '@/lib/types/objects';

function filterTree(nodes: HierarchyTreeNode[], query: string, showDeactivated: boolean): HierarchyTreeNode[] {
    if (!query.trim() && showDeactivated) return nodes;

    const lowerQuery = query.toLowerCase();

    function filterNode(node: HierarchyTreeNode): HierarchyTreeNode | null {
        const matchesQuery = !query.trim() || node.name.toLowerCase().includes(lowerQuery);

        const filteredChildren = node.children
            .map(child => filterNode(child))
            .filter((child): child is HierarchyTreeNode => child !== null);

        const hasVisibleChildren = filteredChildren.length > 0;
        const isVisibleByStatus = showDeactivated || node.is_active || hasVisibleChildren;

        if (!isVisibleByStatus) return null;

        if (matchesQuery || hasVisibleChildren) {
            return {
                ...node,
                children: filteredChildren,
            };
        }
        return null;
    }

    return nodes
        .map(node => filterNode(node))
        .filter((node): node is HierarchyTreeNode => node !== null);
}

export function ServiceCatalogsListPage() {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');
    const [showDeactivated, setShowDeactivated] = useState(false);
    const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined);

    const {
        items: serviceCatalogs,
        total: totalServiceCatalogs,
        isInitialLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        reload,
    } = useInfiniteResource<ServiceCatalog>('service-catalogs', {
        pageSize: 1000,
        auto: true,
    });

    const treeNodes = useMemo(() => buildHierarchyTree(serviceCatalogs), [serviceCatalogs]);

    const filteredNodes = useMemo(
        () => filterTree(treeNodes, searchQuery, showDeactivated),
        [treeNodes, searchQuery, showDeactivated]
    );

    const totalNodes = serviceCatalogs.length;
    const activeNodes = useMemo(
        () => serviceCatalogs.reduce((count, node) => count + (node.is_active ? 1 : 0), 0),
        [serviceCatalogs]
    );

    useEffect(() => {
        if (isInitialLoading || isLoadingMore || !hasMore) return;
        void loadMore();
    }, [hasMore, isInitialLoading, isLoadingMore, loadMore]);

    const handleRefresh = () => {
        void reload();
    };

    const handleExpandAll = () => {
        setExpandAll(true);
    };

    const handleCollapseAll = () => {
        setExpandAll(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <QuickScrollRail />
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400'}
            `}>
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                Service Catalogs
                            </h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {activeNodes.toLocaleString()} Active Loaded / {totalNodes.toLocaleString()} Loaded / {(totalServiceCatalogs ?? totalNodes).toLocaleString()} Total
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className={`
                p-2 rounded-lg transition-colors
                ${isLight
                                    ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                                }
              `}
                            title="Refresh"
                        >
                            <RefreshCw className={`w-5 h-5 ${(isInitialLoading || isLoadingMore) ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => router.push('/data/service-catalogs/new')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Service Catalog</span>
                        </button>
                    </div>
                </div>

                {/* Search and Controls */}
                <div className="flex items-center gap-2 mb-4">
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search service catalogs..."
                            className={`
                                w-full pl-10 pr-10 py-2 rounded-lg
                                ${isLight ? 'bg-slate-100 text-slate-800 placeholder-slate-400' : 'bg-white/10 text-white placeholder-gray-500'}
                                focus:outline-none focus:ring-2 focus:ring-purple-500/50
                            `}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className={`absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded ${isLight ? 'text-slate-400 hover:text-slate-600' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setShowDeactivated(!showDeactivated)}
                        className={`
                            p-2 rounded-lg transition-colors
                            ${showDeactivated
                                ? (isLight ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400')
                                : (isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10')
                            }
                        `}
                        title={showDeactivated ? 'Hide Deactivated' : 'Show Deactivated'}
                    >
                        {showDeactivated ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={handleExpandAll}
                        className={`
                            p-2 rounded-lg transition-colors
                            ${isLight
                                ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }
                        `}
                        title="Expand All"
                    >
                        <ChevronsUpDown className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleCollapseAll}
                        className={`
                            p-2 rounded-lg transition-colors
                            ${isLight
                                ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                : 'text-gray-400 hover:text-white hover:bg-white/10'
                            }
                        `}
                        title="Collapse All"
                    >
                        <ChevronsDownUp className="w-5 h-5" />
                    </button>
                </div>

                {searchQuery && (
                    <p className={`text-xs mb-2 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        {filteredNodes.length === 0 ? 'No matches found' : `Showing matches for "${searchQuery}"`}
                    </p>
                )}

                {/* Tree View */}
                <div className={`
          rounded-xl border overflow-hidden
          ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}
        `}>
                    {isInitialLoading && serviceCatalogs.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading service catalogs...</span>
                        </div>
                    ) : error && serviceCatalogs.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : (
                        <HierarchyTree
                            nodes={filteredNodes}
                            baseHref="/data/service-catalogs"
                            emptyMessage={searchQuery ? 'No matching service catalogs found.' : 'No service catalogs found. Create your first service catalog to get started.'}
                            expandAll={expandAll}
                        />
                    )}
                </div>

                {hasMore && (
                    <InfiniteLoadTrigger
                        disabled={isInitialLoading || isLoadingMore}
                        onVisible={() => void loadMore()}
                    />
                )}

                {isLoadingMore && (
                    <div className={`py-4 text-center text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading more service catalogs...</span>
                    </div>
                )}
            </div>
        </div>
    );
}
