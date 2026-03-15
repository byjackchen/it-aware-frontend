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

        // Outer node positions (radial)
        const outerPositions: NodePosition[] = outerNodes.map((node, i) => {
            const angle = n === 1
                ? -Math.PI / 2
                : (i * 2 * Math.PI) / n - Math.PI / 2;

            return {
                oid: node.oid,
                cx: cx + radius * Math.cos(angle),
                cy: cy + radius * Math.sin(angle),
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
        // Group edges by (sourceOid, targetOid) pair to offset parallel edges
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

        // Count edges per pair
        edgeDataList.forEach((ed) => {
            const key = pairKey(ed.sourceOid, ed.targetOid);
            pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
        });

        const edgePaths: EdgePath[] = edgeDataList
            .map((ed) => {
                const sourcePos = posMap.get(ed.sourceOid);
                const targetPos = posMap.get(ed.targetOid);
                if (!sourcePos || !targetPos) return null;

                // Calculate offset for parallel edges
                const key = pairKey(ed.sourceOid, ed.targetOid);
                const count = pairCounts.get(key) ?? 1;
                const idx = pairIndexes.get(key) ?? 0;
                pairIndexes.set(key, idx + 1);

                let offset = 0;
                if (count > 1) {
                    offset = ((idx - (count - 1) / 2)) * PARALLEL_EDGE_OFFSET;
                }

                // Compute angle from source to target for boundary point calculation
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

                // Edge color: use the connected node's type color
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
