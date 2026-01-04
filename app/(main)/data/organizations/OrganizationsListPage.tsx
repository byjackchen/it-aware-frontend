'use client';

/**
 * Organizations list page client component with tree view and search.
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, RefreshCw, Search, X, ChevronsUpDown, ChevronsDownUp } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { HierarchyTree } from '@/components/data';
import type { HierarchyTreeNode } from '@/lib/types/objects';

interface OrganizationsListPageProps {
    treeNodes: HierarchyTreeNode[];
}

// Count all nodes in the tree recursively
function countNodes(nodes: HierarchyTreeNode[]): number {
    return nodes.reduce((count, node) => count + 1 + countNodes(node.children), 0);
}

// Filter tree nodes by search query, keeping matching nodes and their ancestors
function filterTree(nodes: HierarchyTreeNode[], query: string): HierarchyTreeNode[] {
    if (!query.trim()) return nodes;

    const lowerQuery = query.toLowerCase();

    function filterNode(node: HierarchyTreeNode): HierarchyTreeNode | null {
        const matchesQuery = node.name.toLowerCase().includes(lowerQuery);
        const filteredChildren = node.children
            .map(child => filterNode(child))
            .filter((child): child is HierarchyTreeNode => child !== null);

        // Include node if it matches or has matching children
        if (matchesQuery || filteredChildren.length > 0) {
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

export function OrganizationsListPage({ treeNodes }: OrganizationsListPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [expandAll, setExpandAll] = useState<boolean | undefined>(undefined);

    const filteredNodes = useMemo(
        () => filterTree(treeNodes, searchQuery),
        [treeNodes, searchQuery]
    );

    const totalNodes = useMemo(() => countNodes(treeNodes), [treeNodes]);

    const handleRefresh = () => {
        setIsRefreshing(true);
        router.refresh();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleExpandAll = () => {
        setExpandAll(true);
    };

    const handleCollapseAll = () => {
        setExpandAll(false);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center
              ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}
            `}>
                            <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                Organizations
                            </h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {totalNodes} total node{totalNodes !== 1 ? 's' : ''} • {treeNodes.length} root{treeNodes.length !== 1 ? 's' : ''}
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
                            <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={() => router.push('/data/organizations/new')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Organization</span>
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
                            placeholder="Search organizations..."
                            className={`
                                w-full pl-10 pr-10 py-2 rounded-lg
                                ${isLight ? 'bg-slate-100 text-slate-800 placeholder-slate-400' : 'bg-white/10 text-white placeholder-gray-500'}
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50
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
                    <HierarchyTree
                        nodes={filteredNodes}
                        baseHref="/data/organizations"
                        emptyMessage={searchQuery ? 'No matching organizations found.' : 'No organizations found. Create your first organization to get started.'}
                        expandAll={expandAll}
                    />
                </div>
            </div>
        </div>
    );
}
