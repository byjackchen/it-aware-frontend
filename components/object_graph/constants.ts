// Layout
export const GRAPH_PADDING = 60;
export const CENTRAL_RX = 50;
export const CENTRAL_RY = 30;
export const OUTER_RX = 44;
export const OUTER_RY = 24;
export const RADIAL_RADIUS_BASE = 180;
export const RADIAL_RADIUS_LARGE = 240;
export const RADIAL_LARGE_THRESHOLD = 8;
export const ARROW_SIZE = 8;
export const LABEL_MAX_CHARS = 20;
export const EDGE_LABEL_MAX_CHARS = 16;
export const DOT_GRID_SIZE = 16;
export const DOT_GRID_RADIUS = 1;
export const MIN_CANVAS_HEIGHT = 400;
export const HOVER_TOOLTIP_MAX_WIDTH = 320;
export const PARALLEL_EDGE_OFFSET = 30;

// Slider
export const SLIDER_HEIGHT = 32;
export const SLIDER_HANDLE_RADIUS = 8;
export const SLIDER_DEBOUNCE_MS = 300;

// Type colors
export const TYPE_COLORS: Record<string, { bg: string; border: string }> = {
    organization: { bg: '#3b82f6', border: '#2563eb' },
    location: { bg: '#10b981', border: '#059669' },
    worker: { bg: '#8b5cf6', border: '#7c3aed' },
    article: { bg: '#14b8a6', border: '#0d9488' },
    incident: { bg: '#ef4444', border: '#dc2626' },
    request: { bg: '#f97316', border: '#ea580c' },
    inquiry: { bg: '#a855f7', border: '#9333ea' },
    interaction: { bg: '#2563eb', border: '#1d4ed8' },
    service_catalog: { bg: '#06b6d4', border: '#0891b2' },
    survey: { bg: '#10b981', border: '#059669' },
    analysis: { bg: '#ec4899', border: '#db2777' },
    notification: { bg: '#f59e0b', border: '#d97706' },
    default: { bg: '#6b7280', border: '#4b5563' },
};
