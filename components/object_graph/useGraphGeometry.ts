import { useMemo } from 'react';
import type { GlobalEdge } from '@/lib/types/objects';
import type { GraphNode, NodePosition, EdgePath, GraphGeometry, GraphEdgeData } from './types';
import {
    GRAPH_PADDING,
    CENTRAL_RX,
    CENTRAL_RY,
    OUTER_RX,
    OUTER_RY,
    RADIAL_RADIUS_BASE,
    RADIAL_RADIUS_LARGE,
    RADIAL_LARGE_THRESHOLD,
    PARALLEL_EDGE_OFFSET,
    FORCE_ITERATIONS,
    FORCE_REPULSION,
    FORCE_SPRING_LENGTH,
    FORCE_SPRING_STRENGTH,
    FORCE_DAMPING,
    FORCE_CENTER_PULL,
} from './constants';
import { truncateLabel, truncateEdgeLabel, getTypeColor, computeBezierPath, ellipseBoundary } from './utils';

interface UseGraphGeometryParams {
    centralOid: string;
    centralObjectType: string;
    centralDescriptor: string;
    edges: GlobalEdge[];
    containerWidth: number;
    containerHeight: number;
}

interface ForceNode {
    oid: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    isCentral: boolean;
}

/**
 * Simple deterministic hash for seeding positions from OID string.
 */
function hashOid(oid: string): number {
    let h = 0;
    for (let i = 0; i < oid.length; i++) {
        h = ((h << 5) - h + oid.charCodeAt(i)) | 0;
    }
    return h;
}

/**
 * Run a simple force-directed simulation to compute scattered node positions.
 * Uses repulsion between all nodes, spring attraction along edges, and a gentle
 * center pull to keep the layout compact.
 */
function forceLayout(
    nodes: ForceNode[],
    edgePairs: Array<{ source: number; target: number }>,
    cx: number,
    cy: number,
): void {
    for (let iter = 0; iter < FORCE_ITERATIONS; iter++) {
        const decay = FORCE_DAMPING * (1 - iter / FORCE_ITERATIONS * 0.5);

        // Repulsion: all pairs
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                let dx = nodes[j].x - nodes[i].x;
                let dy = nodes[j].y - nodes[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = FORCE_REPULSION / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                if (!nodes[i].isCentral) {
                    nodes[i].vx -= fx;
                    nodes[i].vy -= fy;
                }
                if (!nodes[j].isCentral) {
                    nodes[j].vx += fx;
                    nodes[j].vy += fy;
                }
            }
        }

        // Spring attraction: edges
        for (const { source, target } of edgePairs) {
            const s = nodes[source];
            const t = nodes[target];
            const dx = t.x - s.x;
            const dy = t.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const displacement = dist - FORCE_SPRING_LENGTH;
            const force = FORCE_SPRING_STRENGTH * displacement;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            if (!s.isCentral) {
                s.vx += fx;
                s.vy += fy;
            }
            if (!t.isCentral) {
                t.vx -= fx;
                t.vy -= fy;
            }
        }

        // Center pull
        for (const node of nodes) {
            if (node.isCentral) continue;
            node.vx += (cx - node.x) * FORCE_CENTER_PULL;
            node.vy += (cy - node.y) * FORCE_CENTER_PULL;
        }

        // Integrate
        for (const node of nodes) {
            if (node.isCentral) continue;
            node.vx *= decay;
            node.vy *= decay;
            node.x += node.vx;
            node.y += node.vy;
        }
    }
}

export function useGraphGeometry({
    centralOid,
    centralObjectType,
    centralDescriptor,
    edges,
    containerWidth,
    containerHeight,
}: UseGraphGeometryParams): GraphGeometry {
    return useMemo(() => {
        if (containerWidth === 0 || containerHeight === 0) {
            return { viewBox: '0 0 0 0', width: 0, height: 0, nodes: [], edges: [] };
        }

        // Build connected nodes map (deduped)
        const connectedNodes = new Map<string, GraphNode>();

        edges.forEach((edge) => {
            const isOutgoing = edge.from_oid === centralOid;
            const connectedOid = isOutgoing ? edge.to_oid : edge.from_oid;
            const connectedObject = isOutgoing ? edge.to_object : edge.from_object;

            if (connectedObject && !connectedNodes.has(connectedOid)) {
                connectedNodes.set(connectedOid, {
                    oid: connectedOid,
                    objectType: connectedObject.object_type,
                    descriptor: connectedObject.descriptor,
                    isCentral: false,
                });
            }
        });

        const outerNodes = Array.from(connectedNodes.values());
        const n = outerNodes.length;
        const radius = n > RADIAL_LARGE_THRESHOLD ? RADIAL_RADIUS_LARGE : RADIAL_RADIUS_BASE;

        // Canvas sizing
        const size = (radius + OUTER_RX + GRAPH_PADDING) * 2;
        const canvasW = Math.max(containerWidth, size);
        const canvasH = Math.max(containerHeight, size);
        const cx = canvasW / 2;
        const cy = canvasH / 2;

        // Initialize force nodes with deterministic scattered starting positions
        const forceNodes: ForceNode[] = [
            { oid: centralOid, x: cx, y: cy, vx: 0, vy: 0, isCentral: true },
        ];

        outerNodes.forEach((node, i) => {
            // Start at radial position with per-node jitter from OID hash
            const baseAngle = n === 1
                ? -Math.PI / 2
                : (i * 2 * Math.PI) / n - Math.PI / 2;
            const h = hashOid(node.oid);
            const jitterR = 0.6 + ((h & 0xff) / 255) * 0.8; // 0.6..1.4
            const jitterAngle = ((h >> 8) & 0xff) / 255 * 0.6 - 0.3; // ±0.3 rad
            const r = radius * jitterR;
            const a = baseAngle + jitterAngle;

            forceNodes.push({
                oid: node.oid,
                x: cx + r * Math.cos(a),
                y: cy + r * Math.sin(a),
                vx: 0,
                vy: 0,
                isCentral: false,
            });
        });

        // Build edge pairs for simulation (index-based)
        const oidToIndex = new Map<string, number>();
        forceNodes.forEach((fn, i) => oidToIndex.set(fn.oid, i));

        const edgePairsForSim: Array<{ source: number; target: number }> = [];
        const seenEdgePairs = new Set<string>();
        edges.forEach((edge) => {
            const si = oidToIndex.get(edge.from_oid);
            const ti = oidToIndex.get(edge.to_oid);
            if (si !== undefined && ti !== undefined) {
                const key = si < ti ? `${si}-${ti}` : `${ti}-${si}`;
                if (!seenEdgePairs.has(key)) {
                    seenEdgePairs.add(key);
                    edgePairsForSim.push({ source: si, target: ti });
                }
            }
        });

        // Run force simulation
        forceLayout(forceNodes, edgePairsForSim, cx, cy);

        // Clamp positions to canvas bounds
        for (const fn of forceNodes) {
            if (fn.isCentral) continue;
            fn.x = Math.max(OUTER_RX + GRAPH_PADDING, Math.min(canvasW - OUTER_RX - GRAPH_PADDING, fn.x));
            fn.y = Math.max(OUTER_RY + GRAPH_PADDING, Math.min(canvasH - OUTER_RY - GRAPH_PADDING, fn.y));
        }

        // Central node position
        const centralPos: NodePosition = {
            oid: centralOid,
            cx,
            cy,
            rx: CENTRAL_RX,
            ry: CENTRAL_RY,
            labelLines: [truncateLabel(centralDescriptor)],
            node: {
                oid: centralOid,
                objectType: centralObjectType,
                descriptor: centralDescriptor,
                isCentral: true,
            },
        };

        // Outer node positions from force simulation
        const outerPositions: NodePosition[] = outerNodes.map((node, i) => {
            const fn = forceNodes[i + 1]; // +1 to skip central
            return {
                oid: node.oid,
                cx: fn.x,
                cy: fn.y,
                rx: OUTER_RX,
                ry: OUTER_RY,
                labelLines: [truncateLabel(node.descriptor)],
                node,
            };
        });

        const allPositions = [centralPos, ...outerPositions];
        const posMap = new Map<string, NodePosition>();
        allPositions.forEach((p) => posMap.set(p.oid, p));

        // Build edge paths
        const pairKey = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;
        const pairCounts = new Map<string, number>();
        const pairIndexes = new Map<string, number>();

        const edgeDataList: GraphEdgeData[] = edges.map((edge) => ({
            edge,
            sourceOid: edge.from_oid,
            targetOid: edge.to_oid,
            edgeType: edge.edge_type,
            isActive: edge.is_active,
            effectiveAt: edge.effective_at,
        }));

        edgeDataList.forEach((ed) => {
            const key = pairKey(ed.sourceOid, ed.targetOid);
            pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        });

        const edgePaths: EdgePath[] = edgeDataList
            .map((ed) => {
                const sourcePos = posMap.get(ed.sourceOid);
                const targetPos = posMap.get(ed.targetOid);
                if (!sourcePos || !targetPos) return null;

                const key = pairKey(ed.sourceOid, ed.targetOid);
                const count = pairCounts.get(key) ?? 1;
                const idx = pairIndexes.get(key) ?? 0;
                pairIndexes.set(key, idx + 1);

                let offset = 0;
                if (count > 1) {
                    offset = ((idx - (count - 1) / 2)) * PARALLEL_EDGE_OFFSET;
                }

                const angleToTarget = Math.atan2(
                    targetPos.cy - sourcePos.cy,
                    targetPos.cx - sourcePos.cx
                );
                const angleToSource = angleToTarget + Math.PI;

                const start = ellipseBoundary(
                    sourcePos.cx, sourcePos.cy,
                    sourcePos.rx, sourcePos.ry,
                    angleToTarget
                );
                const end = ellipseBoundary(
                    targetPos.cx, targetPos.cy,
                    targetPos.rx, targetPos.ry,
                    angleToSource
                );

                const bezier = computeBezierPath(start.x, start.y, end.x, end.y, offset);

                const connectedOid = ed.sourceOid === centralOid ? ed.targetOid : ed.sourceOid;
                const connectedNode = connectedNodes.get(connectedOid);
                const color = getTypeColor(connectedNode?.objectType ?? 'default').bg;

                return {
                    id: `${ed.sourceOid}-${ed.targetOid}-${ed.edgeType}`,
                    pathD: bezier.pathD,
                    labelX: bezier.labelX,
                    labelY: bezier.labelY,
                    arrowAngle: bezier.arrowAngle,
                    edgeData: ed,
                    color,
                } satisfies EdgePath;
            })
            .filter((e): e is EdgePath => e !== null);

        return {
            viewBox: `0 0 ${canvasW} ${canvasH}`,
            width: canvasW,
            height: canvasH,
            nodes: allPositions,
            edges: edgePaths,
        };
    }, [centralOid, centralObjectType, centralDescriptor, edges, containerWidth, containerHeight]);
}
