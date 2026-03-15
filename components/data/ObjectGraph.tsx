'use client';

/**
 * Graph visualization component for object relationships using custom SVG rendering.
 * Displays connected edges for any object, with theme-aware styling and effective_at filtering.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { GlobalEdge } from '@/lib/types/objects';
import type { EffectiveAtRange, GraphHoverPayload, NodePosition, EdgePath } from '@/components/object_graph/types';
import { useGraphEdges } from '@/components/object_graph/useGraphEdges';
import { useGraphGeometry } from '@/components/object_graph/useGraphGeometry';
import { GraphCanvas } from '@/components/object_graph/GraphCanvas';
import { GraphControls } from '@/components/object_graph/GraphControls';
import { GraphEmptyState, GraphLoadingState, GraphErrorState } from '@/components/object_graph/GraphStates';
import { MIN_CANVAS_HEIGHT } from '@/components/object_graph/constants';
import { formatRangeDate } from '@/components/object_graph/utils';

interface ObjectGraphProps {
    oid: string;
    objectType: string;
    descriptor: string;
    edges: GlobalEdge[];
    allEdges?: GlobalEdge[];
    onFilterChange?: (objectType: string | null) => void;
    selectedFilter?: string | null;
}

export function ObjectGraph({
    oid,
    objectType,
    descriptor,
    edges: initialEdgesProp,
    allEdges: allEdgesProp,
    onFilterChange,
    selectedFilter: externalSelectedFilter,
}: ObjectGraphProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // Internal filter state (used when no external filter is provided)
    const [internalFilter, setInternalFilter] = useState<string | null>(null);
    const selectedFilter = externalSelectedFilter ?? internalFilter;
    const handleFilterChange = onFilterChange ?? setInternalFilter;

    // Effective at range state
    const [effectiveAtRange, setEffectiveAtRange] = useState<EffectiveAtRange | null>(null);

    // Container ref for ResizeObserver
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 0, height: MIN_CANVAS_HEIGHT });

    // Hover state
    const [hover, setHover] = useState<GraphHoverPayload | null>(null);

    // Observe container size
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const update = () => {
            setContainerSize({
                width: el.clientWidth,
                height: Math.max(MIN_CANVAS_HEIGHT, el.clientHeight),
            });
        };
        update();

        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    // Edge management with effective_at filtering
    const {
        edges,
        allEdges,
        linkedObjectTypes,
        isLoading,
        error,
        effectiveAtBounds,
    } = useGraphEdges({
        oid,
        initialEdges: allEdgesProp ?? initialEdgesProp,
        effectiveAtRange,
        selectedFilter,
    });

    // Compute graph geometry
    const geometry = useGraphGeometry({
        centralOid: oid,
        centralObjectType: objectType,
        centralDescriptor: descriptor,
        edges,
        containerWidth: containerSize.width,
        containerHeight: containerSize.height,
    });

    // Hover handlers
    const updateHover = useCallback((clientX: number, clientY: number, label: string) => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        setHover({
            x: clientX - rect.left + 14,
            y: clientY - rect.top - 20,
            label,
        });
    }, []);

    const handleNodeHover = useCallback((e: React.MouseEvent, node: NodePosition) => {
        const label = `${node.node.objectType}: ${node.node.descriptor}`;
        updateHover(e.clientX, e.clientY, label);
    }, [updateHover]);

    const handleEdgeHover = useCallback((e: React.MouseEvent, edge: EdgePath) => {
        const parts = [edge.edgeData.edgeType.replace(/_/g, ' ')];
        if (edge.edgeData.effectiveAt) {
            parts.push(`effective: ${formatRangeDate(new Date(edge.edgeData.effectiveAt))}`);
        }
        if (!edge.edgeData.isActive) {
            parts.push('(inactive)');
        }
        updateHover(e.clientX, e.clientY, parts.join('\n'));
    }, [updateHover]);

    const clearHover = useCallback(() => setHover(null), []);

    // Only show bare empty state when there are no initial edges and no active filter
    const hasNoEdgesAtAll = !isLoading && edges.length === 0 && !error && !effectiveAtRange && !selectedFilter;
    if (hasNoEdgesAtAll) {
        return <GraphEmptyState isLight={isLight} />;
    }

    const showEmpty = !isLoading && edges.length === 0 && !error;

    return (
        <div className="space-y-3">
            <GraphControls
                linkedObjectTypes={linkedObjectTypes}
                selectedFilter={selectedFilter}
                onFilterChange={handleFilterChange}
                effectiveAtBounds={effectiveAtBounds}
                effectiveAtRange={effectiveAtRange}
                onEffectiveAtRangeChange={setEffectiveAtRange}
                isLight={isLight}
            />

            <div
                ref={containerRef}
                className={`
                    w-full rounded-xl overflow-hidden border relative
                    ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-gray-900/50'}
                `}
                style={{ minHeight: `${MIN_CANVAS_HEIGHT}px` }}
            >
                {isLoading ? (
                    <GraphLoadingState isLight={isLight} />
                ) : error ? (
                    <GraphErrorState isLight={isLight} message={error} />
                ) : showEmpty ? (
                    <GraphEmptyState isLight={isLight} />
                ) : (
                    <GraphCanvas
                        geometry={geometry}
                        isLight={isLight}
                        hover={hover}
                        onNodeHover={handleNodeHover}
                        onEdgeHover={handleEdgeHover}
                        onClearHover={clearHover}
                    />
                )}
            </div>
        </div>
    );
}
