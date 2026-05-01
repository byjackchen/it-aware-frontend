'use client';

/**
 * Individual tree node for the catalog sidebar.
 * Supports expand/collapse of children and navigation to catalog detail page.
 */

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { HierarchyTreeNode } from '@/lib/types/objects';

interface CatalogTreeNodeProps {
    node: HierarchyTreeNode;
    level: number;
    forceExpand?: boolean;
}

export function CatalogTreeNode({ node, level, forceExpand }: CatalogTreeNodeProps) {
    const router = useTransitionRouter();
    const pathname = usePathname();
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
    const hasChildren = node.children.length > 0;

    // Check if this node or any descendant is currently active
    const isActive = pathname === `/knowledge/catalog/${node.oid}`;
    const isInActivePath = pathname.startsWith('/knowledge/catalog/') &&
        pathname.includes(node.oid);

    // React to forceExpand changes
    useEffect(() => {
        if (forceExpand !== undefined) {
            setIsExpanded(forceExpand);
        }
    }, [forceExpand]);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasChildren) {
            setIsExpanded(!isExpanded);
        }
    };

    const handleClick = () => {
        router.push(`/knowledge/catalog/${node.oid}`);
    };

    return (
        <div>
            {/* Node Row */}
            <div
                onClick={handleClick}
                className={`
                    group flex items-center gap-2 py-1.5 px-2 rounded-lg cursor-pointer
                    transition-all duration-200 ease-out
                    ${isActive
                        ? isLight
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-blue-500/20 text-blue-300'
                        : isLight
                            ? 'hover:bg-slate-100 active:bg-slate-200'
                            : 'hover:bg-white/5 active:bg-white/10'
                    }
                `}
                style={{ paddingLeft: `${level * 16 + 8}px` }}
            >
                {/* Expand/Collapse Toggle */}
                <button
                    onClick={handleToggle}
                    className={`
                        w-4 h-4 flex items-center justify-center rounded transition-colors
                        ${hasChildren
                            ? isLight
                                ? 'text-slate-500 hover:text-slate-700'
                                : 'text-gray-500 hover:text-gray-300'
                            : 'invisible'
                        }
                    `}
                >
                    {hasChildren && (
                        isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5" />
                            : <ChevronRight className="w-3.5 h-3.5" />
                    )}
                </button>

                {/* Folder Icon */}
                <div className={`
                    w-5 h-5 flex items-center justify-center transition-colors
                    ${isActive
                        ? 'text-blue-500'
                        : isLight
                            ? 'text-slate-400 group-hover:text-slate-600'
                            : 'text-gray-500 group-hover:text-gray-400'
                    }
                `}>
                    {isExpanded && hasChildren
                        ? <FolderOpen className="w-4 h-4" />
                        : <Folder className="w-4 h-4" />
                    }
                </div>

                {/* Node Name */}
                <span className={`
                    text-sm font-medium truncate flex-1 transition-colors
                    ${isActive
                        ? isLight
                            ? 'text-blue-700'
                            : 'text-blue-300'
                        : isLight
                            ? 'text-slate-700 group-hover:text-slate-900'
                            : 'text-gray-300 group-hover:text-white'
                    }
                `}>
                    {node.name}
                </span>
            </div>

            {/* Children (Animated) */}
            {hasChildren && isExpanded && (
                <div className="overflow-hidden animate-in slide-in-from-top-1 duration-200">
                    {node.children.map((child) => (
                        <CatalogTreeNode
                            key={child.oid}
                            node={child}
                            level={level + 1}
                            forceExpand={forceExpand}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
