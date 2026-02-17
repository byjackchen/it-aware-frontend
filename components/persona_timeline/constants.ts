import type { PersonaActivityEventType } from '@/app/(main)/persona/types';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const MIN_WINDOW_DAYS = 1;
export const MAX_WINDOW_DAYS = 365;
export const DEFAULT_WINDOW_DAYS = 30;

export const PRESET_WINDOWS = [7, 30, 90] as const;

export const AXIS_SIDE_PADDING = 160;
export const AXIS_MIN_WIDTH = 1400;
export const EVENT_SPACING = 132;

export const TIMELINE_GUARD_X = 64;
export const TIMELINE_TOP_PADDING = 14;

export const TICK_COUNT = 6;
export const TICK_HEIGHT = 7;
export const TICK_LABEL_WIDTH = 164;

export const HEAT_TOP_Y = 28;
export const HEAT_ROW_HEIGHT = 8;
export const HEAT_ROW_GAP = 2;
export const HEAT_AXIS_GAP = 10;
export const HEAT_BIN_PX = 6;
export const HEAT_BIN_MIN = 60;
export const HEAT_BIN_MAX = 720;

export const AXIS_STROKE_WIDTH = 1;
export const AXIS_ENDCAP_RADIUS = 3;
export const MARKER_RADIUS = 3.5;

export const DETAIL_DEFAULT_WIDTH = 220;
export const DETAIL_DEFAULT_HEIGHT = 62;
export const DETAIL_INTERACTION_WIDTH = 174;
export const DETAIL_INTERACTION_HEIGHT = 46;
export const DETAIL_DEFAULT_MIN_WIDTH = 168;
export const DETAIL_INTERACTION_MIN_WIDTH = 132;
export const DETAIL_GAP = 8;
export const DETAIL_TOP_GAP = 14;
export const DETAIL_MIN_HORIZONTAL_GAP = 10;

export const MIN_CANVAS_HEIGHT = 260;
export const CANVAS_BOTTOM_GUARD = 48;

export const HOVER_TOOLTIP_MAX_WIDTH = 360;
export const HOVER_TOOLTIP_OFFSET_X = 14;
export const HOVER_TOOLTIP_OFFSET_Y = 20;

export const DRAG_SHIFT_MIN_MS = 60 * 1000;
export const CLICK_SUPPRESS_MS = 180;

export const TIMELINE_TYPES: PersonaActivityEventType[] = ['incident', 'request', 'inquiry', 'interaction'];

export const EVENT_COLORS: Record<PersonaActivityEventType, string> = {
    incident: '#ef4444',
    request: '#f97316',
    inquiry: '#a855f7',
    interaction: '#2563eb',
};
