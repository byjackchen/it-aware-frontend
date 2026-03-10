import {
    DAY_MS,
    DETAIL_DEFAULT_HEIGHT,
    DETAIL_DEFAULT_MIN_WIDTH,
    DETAIL_DEFAULT_WIDTH,
    DETAIL_INTERACTION_HEIGHT,
    DETAIL_INTERACTION_MIN_WIDTH,
    DETAIL_INTERACTION_WIDTH,
    MAX_WINDOW_DAYS,
    MIN_WINDOW_DAYS,
} from './constants';
import type { PersonaActivityEvent, PersonaActivityEventType, TimelineWindowState } from '@/app/(main)/persona/types';

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function clampWindowDays(days: number): number {
    if (days < MIN_WINDOW_DAYS) return MIN_WINDOW_DAYS;
    if (days > MAX_WINDOW_DAYS) return MAX_WINDOW_DAYS;
    return Math.round(days);
}

export function buildWindow(durationDays: number, endAt: Date = new Date()): TimelineWindowState {
    const normalizedDays = clampWindowDays(durationDays);
    const end = new Date(endAt);
    const start = new Date(end.getTime() - (normalizedDays * DAY_MS));
    return { start, end, durationDays: normalizedDays };
}

export function parseTimestamp(value: string): number {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
}

export function toRangeRatio(timestampMs: number, startMs: number, endMs: number): number {
    const rangeMs = Math.max(endMs - startMs, 1);
    return clamp((timestampMs - startMs) / rangeMs, 0, 1);
}

export function formatTickDate(date: Date, timezone: string, durationDays: number): string {
    if (durationDays <= 2) {
        return date.toLocaleString(undefined, {
            timeZone: timezone,
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    if (durationDays <= 31) {
        return date.toLocaleDateString(undefined, {
            timeZone: timezone,
            month: 'short',
            day: 'numeric',
        });
    }

    return date.toLocaleDateString(undefined, {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        year: '2-digit',
    });
}

export function formatExactTimestamp(value: string, timezone: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    const formatted = date.toLocaleString(undefined, {
        timeZone: timezone,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
    });

    return `${formatted} (${timezone})`;
}

export function formatHeatInterval(startMs: number, endMs: number, timezone: string): string {
    const start = new Date(startMs);
    const end = new Date(endMs);

    const startText = start.toLocaleString(undefined, {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    const endText = end.toLocaleString(undefined, {
        timeZone: timezone,
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return `${startText} → ${endText} (${timezone})`;
}

export function truncateLabel(value: string, maxLength = 38): string {
    const text = (value ?? '').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1)}…`;
}

export function buildEventLabel(event: PersonaActivityEvent): string {
    const isInteraction = event.type === 'interaction';
    const title = truncateLabel(event.title || event.oid, isInteraction ? 32 : 40);
    const subtitle = (event.subtitle ?? '').trim();
    if (!subtitle) return title;
    return `${title}\n${truncateLabel(subtitle, isInteraction ? 34 : 46)}`;
}

export function getEventBoxSize(type: PersonaActivityEventType, widthScale = 1): { width: number; height: number } {
    const normalizedScale = clamp(widthScale, 0.48, 1);

    if (type === 'interaction') {
        return {
            width: Math.max(
                DETAIL_INTERACTION_MIN_WIDTH,
                Math.round(DETAIL_INTERACTION_WIDTH * normalizedScale)
            ),
            height: DETAIL_INTERACTION_HEIGHT,
        };
    }
    return {
        width: Math.max(
            DETAIL_DEFAULT_MIN_WIDTH,
            Math.round(DETAIL_DEFAULT_WIDTH * normalizedScale)
        ),
        height: DETAIL_DEFAULT_HEIGHT,
    };
}

export function hexToRgba(hexColor: string, alpha: number): string {
    const normalized = hexColor.replace('#', '');
    if (normalized.length !== 6) {
        return hexColor;
    }

    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

export function normalizeSqrt(value: number, maxValue: number): number {
    if (value <= 0 || maxValue <= 0) return 0;
    return Math.sqrt(value / maxValue);
}
