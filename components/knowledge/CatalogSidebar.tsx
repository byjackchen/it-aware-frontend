'use client';

/**
 * Catalog sidebar component for the Knowledge section.
 * Displays an expandable tree view of Service Catalogs.
 */

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { Layers, Loader2 } from 'lucide-react';
import { CatalogTreeNode } from './CatalogTreeNode';
import type { ServiceCatalog, HierarchyTreeNode } from '@/lib/types/objects';

interface CatalogSidebarProps {
    catalogs: ServiceCatalog[];
    isLoading?: boolean;
    error?: string | null;
}

/**
 * Build a tree structure from flat catalog list.
 */
function buildCatalogTree(catalogs: ServiceCatalog[]): HierarchyTreeNode[] {
    const catalogMap = new Map<string, HierarchyTreeNode>();
    const rootNodes: HierarchyTreeNode[] = [];

    // Create nodes for all catalogs
    for (const catalog of catalogs) {
        catalogMap.set(catalog.oid, {
            oid: catalog.oid,
            name: catalog.name,
            children: [],
            is_active: catalog.is_active,
        });
    }

    // Build parent-child relationships
    for (const catalog of catalogs) {
        const node = catalogMap.get(catalog.oid)!;
        if (catalog.parent_oid && catalogMap.has(catalog.parent_oid)) {
            const parent = catalogMap.get(catalog.parent_oid)!;
            parent.children.push(node);
        } else {
            rootNodes.push(node);
        }
    }

    // Sort children alphabetically at each level
    const sortChildren = (nodes: HierarchyTreeNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name));
        for (const node of nodes) {
            sortChildren(node.children);
        }
    };
    sortChildren(rootNodes);

    return rootNodes;
}

export function CatalogSidebar({ catalogs, isLoading, error }: CatalogSidebarProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const t = useTranslations('Knowledge');

    // Build tree from flat catalog list
    const treeNodes = useMemo(() => buildCatalogTree(catalogs), [catalogs]);

    return (
        <aside className={`
            w-64 h-[calc(100vh-4rem)] overflow-y-auto flex-shrink-0
            ${isLight
                ? 'bg-white border-r border-slate-200'
                : 'bg-gray-900/50 border-r border-white/5'
            }
        `}>
            {/* Header */}
            <div className={`
                sticky top-0 z-10 px-4 py-3 border-b
                ${isLight
                    ? 'bg-white border-slate-200'
                    : 'bg-gray-900/80 border-white/5 backdrop-blur-sm'
                }
            `}>
                <div className="flex items-center gap-2">
                    <Layers className={`w-5 h-5 ${isLight ? 'text-blue-500' : 'text-blue-400'}`} />
                    <h2 className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {t('sidebar.title')}
                    </h2>
                </div>
            </div>

            {/* Content */}
            <div className="p-2">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className={`w-6 h-6 animate-spin ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                    </div>
                ) : error ? (
                    <div className={`
                        text-sm text-center py-8 px-4
                        ${isLight ? 'text-red-500' : 'text-red-400'}
                    `}>
                        {t('common.loadError')}
                    </div>
                ) : treeNodes.length === 0 ? (
                    <div className={`
                        text-sm text-center py-8 px-4
                        ${isLight ? 'text-slate-500' : 'text-gray-500'}
                    `}>
                        {t('common.noCatalogs')}
                    </div>
                ) : (
                    <nav>
                        {treeNodes.map((node) => (
                            <CatalogTreeNode
                                key={node.oid}
                                node={node}
                                level={0}
                            />
                        ))}
                    </nav>
                )}
            </div>
        </aside>
    );
}
