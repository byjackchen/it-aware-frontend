import type { GlobalEdge } from '@/lib/types/objects';

export interface GraphNode {
    oid: string;
    objectType: string;
    descriptor: string;
    isCentral: boolean;
}

export interface GraphEdgeData {
    edge: GlobalEdge;
    sourceOid: string;
    targetOid: string;
    edgeType: string;
    isActive: boolean;
    effectiveAt: string | null;
}

export interface NodePosition {
    oid: string;
    cx: number;
    cy: number;
    rx: number;
    ry: number;
    labelLines: string[];
    node: GraphNode;
}

export interface EdgePath {
    id: string;
    pathD: string;
    labelX: number;
    labelY: number;
    arrowAngle: number;
    edgeData: GraphEdgeData;
    color: string;
}

export interface GraphGeometry {
    viewBox: string;
    width: number;
    height: number;
    nodes: NodePosition[];
    edges: EdgePath[];
}

export interface EffectiveAtRange {
    from: Date;
    to: Date;
}

export interface GraphHoverPayload {
    x: number;
    y: number;
    label: string;
}
