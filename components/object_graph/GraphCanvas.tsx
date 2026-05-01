'use client';

import { useCallback } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import type { GraphGeometry, GraphHoverPayload, NodePosition, EdgePath } from './types';
import { ARROW_SIZE, DOT_GRID_SIZE, DOT_GRID_RADIUS, HOVER_TOOLTIP_MAX_WIDTH } from './constants';
import { getTypeColor, getObjectPath, truncateEdgeLabel, formatCompactDate } from './utils';

interface GraphCanvasProps {
    geometry: GraphGeometry;
    isLight: boolean;
    hover: GraphHoverPayload | null;
    onNodeHover: (event: React.MouseEvent, node: NodePosition) => void;
    onEdgeHover: (event: React.MouseEvent, edge: EdgePath) => void;
    onClearHover: () => void;
}

export function GraphCanvas({
    geometry,
    isLight,
    hover,
    onNodeHover,
    onEdgeHover,
    onClearHover,
}: GraphCanvasProps) {
    const router = useTransitionRouter();

    const handleNodeClick = useCallback(
        (node: NodePosition) => {
            if (node.node.isCentral) return;
            const path = getObjectPath(node.node.objectType, node.oid);
            if (path !== '#') router.push(path);
        },
        [router]
    );

    if (geometry.width === 0) return null;

    // Collect unique edge colors for arrow markers
    const markerColors = new Set(geometry.edges.map((e) => e.color));

    const dotColor = isLight ? '#e2e8f0' : '#374151';
    const edgeLabelBg = isLight ? '#ffffff' : '#1f2937';
    const edgeLabelColor = isLight ? '#6b7280' : '#9ca3af';

    return (
        <div className="relative w-full" style={{ height: `${geometry.height}px` }}>
            <svg
                width={geometry.width}
                height={geometry.height}
                viewBox={geometry.viewBox}
                className="block w-full h-full"
            >
                <defs>
                    {/* Dot grid pattern */}
                    <pattern
                        id="graph-dot-grid"
                        width={DOT_GRID_SIZE}
                        height={DOT_GRID_SIZE}
                        patternUnits="userSpaceOnUse"
                    >
                        <circle
                            cx={DOT_GRID_SIZE / 2}
                            cy={DOT_GRID_SIZE / 2}
                            r={DOT_GRID_RADIUS}
                            fill={dotColor}
                        />
                    </pattern>

                    {/* Arrow markers per color */}
                    {Array.from(markerColors).map((color) => (
                        <marker
                            key={`arrow-${color}`}
                            id={`arrow-${color.replace('#', '')}`}
                            viewBox={`0 0 ${ARROW_SIZE} ${ARROW_SIZE}`}
                            refX={ARROW_SIZE}
                            refY={ARROW_SIZE / 2}
                            markerWidth={ARROW_SIZE}
                            markerHeight={ARROW_SIZE}
                            orient="auto-start-reverse"
                        >
                            <path
                                d={`M 0 0 L ${ARROW_SIZE} ${ARROW_SIZE / 2} L 0 ${ARROW_SIZE} Z`}
                                fill={color}
                            />
                        </marker>
                    ))}
                </defs>

                {/* Background dot grid */}
                <rect width="100%" height="100%" fill="url(#graph-dot-grid)" />

                {/* Edge paths */}
                {geometry.edges.map((edge) => {
                    const hasEffectiveAt = !!edge.edgeData.effectiveAt;
                    const effectiveAtLabel = hasEffectiveAt
                        ? formatCompactDate(new Date(edge.edgeData.effectiveAt!))
                        : null;
                    const labelHeight = hasEffectiveAt ? 26 : 16;

                    return (
                        <g key={edge.id}>
                            <path
                                d={edge.pathD}
                                fill="none"
                                stroke={edge.color}
                                strokeWidth={1.5}
                                strokeDasharray={edge.edgeData.isActive ? undefined : '4 3'}
                                markerEnd={`url(#arrow-${edge.color.replace('#', '')})`}
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={(e) => onEdgeHover(e, edge)}
                                onMouseMove={(e) => onEdgeHover(e, edge)}
                                onMouseLeave={onClearHover}
                            />
                            {/* Edge label background */}
                            <rect
                                x={edge.labelX - 36}
                                y={edge.labelY - 8}
                                width={72}
                                height={labelHeight}
                                rx={4}
                                fill={edgeLabelBg}
                                fillOpacity={0.85}
                            />
                            {/* Edge type label */}
                            <text
                                x={edge.labelX}
                                y={edge.labelY + 3}
                                textAnchor="middle"
                                fontSize={9}
                                fill={edgeLabelColor}
                                style={{ pointerEvents: 'none' }}
                            >
                                {truncateEdgeLabel(edge.edgeData.edgeType)}
                            </text>
                            {/* Effective_at date label */}
                            {effectiveAtLabel && (
                                <text
                                    x={edge.labelX}
                                    y={edge.labelY + 14}
                                    textAnchor="middle"
                                    fontSize={8}
                                    fill={edgeLabelColor}
                                    opacity={0.7}
                                    style={{ pointerEvents: 'none' }}
                                >
                                    {effectiveAtLabel}
                                </text>
                            )}
                        </g>
                    );
                })}

                {/* Nodes */}
                {geometry.nodes.map((node) => {
                    const colors = getTypeColor(node.node.objectType);
                    const isCentral = node.node.isCentral;

                    return (
                        <g
                            key={node.oid}
                            style={{ cursor: isCentral ? 'default' : 'pointer' }}
                            onClick={() => handleNodeClick(node)}
                            onMouseEnter={(e) => onNodeHover(e, node)}
                            onMouseMove={(e) => onNodeHover(e, node)}
                            onMouseLeave={onClearHover}
                        >
                            <ellipse
                                cx={node.cx}
                                cy={node.cy}
                                rx={node.rx}
                                ry={node.ry}
                                fill={isCentral ? colors.bg : (isLight ? '#ffffff' : '#1f2937')}
                                stroke={colors.border}
                                strokeWidth={2}
                            />
                            {node.labelLines.map((line, i) => (
                                <text
                                    key={i}
                                    x={node.cx}
                                    y={node.cy + (i - (node.labelLines.length - 1) / 2) * 14 + 4}
                                    textAnchor="middle"
                                    fontSize={isCentral ? 12 : 11}
                                    fontWeight={isCentral ? 600 : 500}
                                    fill={isCentral ? '#ffffff' : (isLight ? '#374151' : '#e5e7eb')}
                                    style={{ pointerEvents: 'none' }}
                                >
                                    {line}
                                </text>
                            ))}
                        </g>
                    );
                })}
            </svg>

            {/* Hover tooltip */}
            {hover && (
                <div
                    className={`
                        pointer-events-none absolute z-20 rounded-md border px-2 py-1 text-[11px] font-medium shadow-lg backdrop-blur-sm
                        ${isLight
                            ? 'border-slate-300 bg-white/95 text-slate-800'
                            : 'border-slate-600 bg-slate-900/95 text-slate-100'}
                    `}
                    style={{
                        left: `${hover.x}px`,
                        top: `${hover.y}px`,
                        maxWidth: `${HOVER_TOOLTIP_MAX_WIDTH}px`,
                        whiteSpace: 'pre-line',
                    }}
                >
                    {hover.label}
                </div>
            )}
        </div>
    );
}
