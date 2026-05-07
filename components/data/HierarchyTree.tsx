'use client';

/**
 * Modern tree view component for hierarchical data (organizations/locations).
 * Features: expandable/collapsible nodes, theme-aware styling, click-to-navigate.
 */

import { useState, useMemo, useEffect } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { ChevronRight, ChevronDown, Circle, CircleDot, Network } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { HierarchyTreeNode } from '@/lib/types/objects';

interface HierarchyTreeProps {
    nodes: HierarchyTreeNode[];
    baseHref: string; // e.g., '/data/organizations' or '/data/locations'
    emptyMessage?: string;
    expandAll?: boolean; // When true, all nodes are expanded
}

interface TreeNodeProps {
    node: HierarchyTreeNode;
    baseHref: string;
    level: number;
    isLight: boolean;
    forceExpand?: boolean;
}

function TreeNode({ node, baseHref, level, isLight, forceExpand }: TreeNodeProps) {
    const router = useTransitionRouter();
    const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
    const hasChildren = node.children.length > 0;

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
        router.push(`${baseHref}/${node.oid}`);
    };

    return (
        <div>
            {/* Node Row */}
            <div
                onClick={handleClick}
                className={`
          group flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer
          transition-all duration-200 ease-out
          ${isLight
                        ? 'hover:bg-slate-100 active:bg-slate-200'
                        : 'hover:bg-white/5 active:bg-white/10'
                    }
        `}
                style={{ paddingLeft: `${level * 20 + 12}px` }}
            >
                {/* Expand/Collapse Toggle */}
                <button
                    onClick={handleToggle}
                    className={`
            w-5 h-5 flex items-center justify-center rounded transition-colors
            ${hasChildren
                            ? isLight
                                ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'
                                : 'text-gray-500 hover:text-gray-300 hover:bg-white/10'
                            : 'invisible'
                        }
          `}
                >
                    {hasChildren && (
                        isExpanded
                            ? <ChevronDown className="w-4 h-4" />
                            : <ChevronRight className="w-4 h-4" />
                    )}
                </button>

                {/* Node Icon */}
                <div className={`
          w-6 h-6 flex items-center justify-center rounded-md transition-colors
          ${isLight
                        ? 'text-blue-500 bg-blue-50 group-hover:bg-blue-100'
                        : 'text-blue-400 bg-blue-500/10 group-hover:bg-blue-500/20'
                    }
        `}>
                    {hasChildren
                        ? <CircleDot className="w-3.5 h-3.5" />
                        : <Circle className="w-3.5 h-3.5" />
                    }
                </div>

                {/* Node Name */}
                <span className={`
          text-sm font-medium truncate flex-1 transition-colors
          ${isLight
                        ? 'text-slate-700 group-hover:text-slate-900'
                        : 'text-gray-200 group-hover:text-white'
                    }
          ${!node.is_active ? 'text-slate-400 italic' : ''}
        `}>
                    {node.name}
                    {!node.is_active && (
                        <span className={`
                            ml-2 text-xs px-1.5 py-0.5 rounded-full
                            ${isLight ? 'bg-slate-100 text-slate-500' : 'bg-white/5 text-gray-500'}
                        `}>
                            Deactivated
                        </span>
                    )}
                </span>

                {/* Children Count Badge */}
                {hasChildren && (
                    <span className={`
            text-xs px-1.5 py-0.5 rounded-full transition-colors
            ${isLight
                            ? 'text-slate-500 bg-slate-100 group-hover:bg-slate-200'
                            : 'text-gray-500 bg-white/5 group-hover:bg-white/10'
                        }
          `}>
                        {node.children.length}
                    </span>
                )}
            </div>

            {/* Children (Animated) */}
            {hasChildren && isExpanded && (
                <div className="overflow-hidden animate-in slide-in-from-top-1 duration-200">
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.oid}
                            node={child}
                            baseHref={baseHref}
                            level={level + 1}
                            isLight={isLight}
                            forceExpand={forceExpand}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export function HierarchyTree({ nodes, baseHref, emptyMessage = 'No items found', expandAll }: HierarchyTreeProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // Build tree structure from flat list
    const rootNodes = useMemo(() => nodes, [nodes]);

    if (rootNodes.length === 0) {
        return (
            <div className={`
        flex flex-col items-center justify-center py-12 px-4
        ${isLight ? 'text-slate-500' : 'text-gray-500'}
      `}>
                <Network className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="py-2">
            {rootNodes.map((node) => (
                <TreeNode
                    key={node.oid}
                    node={node}
                    baseHref={baseHref}
                    level={0}
                    isLight={isLight}
                    forceExpand={expandAll}
                />
            ))}
        </div>
    );
}
