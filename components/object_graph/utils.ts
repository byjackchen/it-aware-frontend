import { LABEL_MAX_CHARS, EDGE_LABEL_MAX_CHARS, TYPE_COLORS } from './constants';

export function truncateLabel(text: string, maxChars: number = LABEL_MAX_CHARS): string {
    const trimmed = (text ?? '').trim();
    if (trimmed.length <= maxChars) return trimmed;
    return `${trimmed.slice(0, maxChars - 1)}…`;
}

export function truncateEdgeLabel(text: string): string {
    return truncateLabel(text.replace(/_/g, ' '), EDGE_LABEL_MAX_CHARS);
}

export function getTypeColor(objectType: string): { bg: string; border: string } {
    return TYPE_COLORS[objectType] ?? TYPE_COLORS.default;
}

export function getObjectPath(objectType: string, oid: string): string {
    switch (objectType) {
        case 'organization': return `/data/organizations/${oid}`;
        case 'location': return `/data/locations/${oid}`;
        case 'worker': return `/data/workers/${oid}`;
        case 'article': return `/data/articles/${oid}`;
        case 'incident': return `/data/incidents/${oid}`;
        case 'request': return `/data/requests/${oid}`;
        case 'inquiry': return `/data/inquiries/${oid}`;
        case 'interaction': return `/data/interactions/${oid}`;
        case 'service_catalog': return `/data/service-catalogs/${oid}`;
        default: return '#';
    }
}

export function computeBezierPath(
    sx: number, sy: number,
    tx: number, ty: number,
    offset: number
): { pathD: string; labelX: number; labelY: number; arrowAngle: number } {
    const dx = tx - sx;
    const dy = ty - sy;
    const mx = (sx + tx) / 2;
    const my = (sy + ty) / 2;

    // Perpendicular offset for the control point
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const cpx = mx + nx * offset;
    const cpy = my + ny * offset;

    const pathD = `M ${sx} ${sy} Q ${cpx} ${cpy} ${tx} ${ty}`;

    // Label at midpoint of the quadratic bezier: B(0.5) = 0.25*P0 + 0.5*CP + 0.25*P1
    const labelX = 0.25 * sx + 0.5 * cpx + 0.25 * tx;
    const labelY = 0.25 * sy + 0.5 * cpy + 0.25 * ty;

    // Arrow angle at the endpoint: tangent at t=1 is 2*(CP-P1) direction → reversed for marker
    const tangentX = tx - cpx;
    const tangentY = ty - cpy;
    const arrowAngle = Math.atan2(tangentY, tangentX) * (180 / Math.PI);

    return { pathD, labelX, labelY, arrowAngle };
}

export function formatRangeDate(date: Date): string {
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export function formatCompactDate(date: Date): string {
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
    });
}

/** Get a point on the ellipse boundary at the given angle */
export function ellipseBoundary(
    cx: number, cy: number,
    rx: number, ry: number,
    angle: number
): { x: number; y: number } {
    return {
        x: cx + rx * Math.cos(angle),
        y: cy + ry * Math.sin(angle),
    };
}
