'use client';

/**
 * Graph visualization component for object relationships using React Flow.
 * Displays connected edges for any object, with theme-aware styling.
 */

import { useMemo, useCallback } from 'react';
import {
    ReactFlow,
    Node,
    Edge,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    MarkerType,
    Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useRouter } from 'next/navigation';
import { useTheme } from '@/lib/contexts/theme-context';
import type { GlobalEdge } from '@/lib/types/objects';

interface ObjectGraphProps {
    oid: string;
    objectType: string;
    descriptor: string;
    edges: GlobalEdge[];
    onFilterChange?: (edgeType: string | null) => void;
    selectedFilter?: string | null;
}

// Color mapping for object types
const TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
    organization: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' },
    location: { bg: '#10b981', border: '#059669', text: '#ffffff' },
    worker: { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff' },
    ticket: { bg: '#f59e0b', border: '#d97706', text: '#ffffff' },
    default: { bg: '#6b7280', border: '#4b5563', text: '#ffffff' },
};

// Get navigation path for object type
function getObjectPath(objectType: string, oid: string): string {
    switch (objectType) {
        case 'organization':
            return `/data/organizations/${oid}`;
        case 'location':
            return `/data/locations/${oid}`;
        case 'worker':
            return `/data/workers/${oid}`;
        case 'ticket':
            return `/data/tickets/${oid}`;
        default:
            return '#';
    }
}

export function ObjectGraph({
    oid,
    objectType,
    descriptor,
    edges,
    onFilterChange,
    selectedFilter,
}: ObjectGraphProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';

    // Build nodes and edges for React Flow
    const { initialNodes, initialEdges, edgeTypes } = useMemo(() => {
        const nodeMap = new Map<string, Node>();
        const flowEdges: Edge[] = [];
        const types = new Set<string>();

        // Central node
        const colors = TYPE_COLORS[objectType] || TYPE_COLORS.default;
        nodeMap.set(oid, {
            id: oid,
            position: { x: 300, y: 200 },
            data: {
                label: descriptor,
                objectType,
                isCentral: true,
            },
            style: {
                background: colors.bg,
                border: `2px solid ${colors.border}`,
                color: colors.text,
                borderRadius: '9999px',
                padding: '10px 20px',
                fontWeight: 600,
                fontSize: '13px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            },
            sourcePosition: Position.Right,
            targetPosition: Position.Left,
        });

        // Process edges and create connected nodes
        edges.forEach((edge, index) => {
            types.add(edge.edge_type);

            const isOutgoing = edge.from_oid === oid;
            const connectedOid = isOutgoing ? edge.to_oid : edge.from_oid;
            const connectedObject = isOutgoing ? edge.to_object : edge.from_object;

            if (connectedObject && !nodeMap.has(connectedOid)) {
                const nodeColors = TYPE_COLORS[connectedObject.object_type] || TYPE_COLORS.default;
                const angle = (index * 2 * Math.PI) / edges.length;
                const radius = 180;

                nodeMap.set(connectedOid, {
                    id: connectedOid,
                    position: {
                        x: 300 + radius * Math.cos(angle),
                        y: 200 + radius * Math.sin(angle),
                    },
                    data: {
                        label: connectedObject.descriptor,
                        objectType: connectedObject.object_type,
                        oid: connectedOid,
                    },
                    style: {
                        background: isLight ? '#ffffff' : '#1f2937',
                        border: `2px solid ${nodeColors.bg}`,
                        color: isLight ? '#374151' : '#e5e7eb',
                        borderRadius: '9999px',
                        padding: '8px 18px',
                        fontSize: '12px',
                        cursor: 'pointer',
                    },
                    sourcePosition: Position.Right,
                    targetPosition: Position.Left,
                });
            }

            // Create edge
            flowEdges.push({
                id: `${edge.from_oid}-${edge.to_oid}-${edge.edge_type}`,
                source: edge.from_oid,
                target: edge.to_oid,
                label: edge.edge_type.replace(/_/g, ' '),
                labelStyle: {
                    fill: isLight ? '#6b7280' : '#9ca3af',
                    fontSize: 10,
                },
                labelBgStyle: {
                    fill: isLight ? '#ffffff' : '#1f2937',
                    fillOpacity: 0.8,
                },
                style: {
                    stroke: isLight ? '#9ca3af' : '#4b5563',
                    strokeWidth: 1.5,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 15,
                    height: 15,
                    color: isLight ? '#9ca3af' : '#4b5563',
                },
                animated: edge.is_active,
            });
        });

        return {
            initialNodes: Array.from(nodeMap.values()),
            initialEdges: flowEdges,
            edgeTypes: Array.from(types).sort(),
        };
    }, [oid, objectType, descriptor, edges, isLight]);

    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [flowEdges, , onEdgesChange] = useEdgesState(initialEdges);

    const onNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            if (!node.data.isCentral && node.data.objectType) {
                router.push(getObjectPath(node.data.objectType, node.id));
            }
        },
        [router]
    );

    if (edges.length === 0) {
        return (
            <div className={`
        flex flex-col items-center justify-center py-12
        ${isLight ? 'text-slate-500' : 'text-gray-500'}
      `}>
                <p className="text-sm">No relationships found</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Edge Type Filter */}
            {onFilterChange && edgeTypes.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        Filter:
                    </span>
                    <button
                        onClick={() => onFilterChange(null)}
                        className={`
              px-2 py-1 text-xs rounded-md transition-colors
              ${selectedFilter === null
                                ? 'bg-blue-500 text-white'
                                : isLight
                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }
            `}
                    >
                        All
                    </button>
                    {edgeTypes.map((type) => (
                        <button
                            key={type}
                            onClick={() => onFilterChange(type)}
                            className={`
                px-2 py-1 text-xs rounded-md transition-colors
                ${selectedFilter === type
                                    ? 'bg-blue-500 text-white'
                                    : isLight
                                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                }
              `}
                        >
                            {type.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
            )}

            {/* Graph Container */}
            <div
                className={`
          w-full h-[400px] rounded-xl overflow-hidden border
          ${isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-gray-900/50'}
        `}
            >
                <ReactFlow
                    nodes={nodes}
                    edges={flowEdges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={onNodeClick}
                    fitView
                    attributionPosition="bottom-left"
                    proOptions={{ hideAttribution: true }}
                >
                    <Background
                        color={isLight ? '#e2e8f0' : '#374151'}
                        gap={16}
                        size={1}
                    />
                    <Controls
                        style={{
                            background: isLight ? '#ffffff' : '#1f2937',
                            border: isLight ? '1px solid #e2e8f0' : '1px solid #374151',
                            borderRadius: '8px',
                        }}
                    />
                    <MiniMap
                        nodeColor={(node) => {
                            const colors = TYPE_COLORS[node.data?.objectType] || TYPE_COLORS.default;
                            return colors.bg;
                        }}
                        style={{
                            background: isLight ? '#f8fafc' : '#111827',
                            border: isLight ? '1px solid #e2e8f0' : '1px solid #374151',
                            borderRadius: '8px',
                        }}
                        maskColor={isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)'}
                    />
                </ReactFlow>
            </div>
        </div>
    );
}
