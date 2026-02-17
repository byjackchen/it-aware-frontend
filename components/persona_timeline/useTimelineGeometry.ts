import { useMemo } from 'react';
import {
    AXIS_MIN_WIDTH,
    AXIS_SIDE_PADDING,
    CANVAS_BOTTOM_GUARD,
    DETAIL_DEFAULT_HEIGHT,
    DETAIL_GAP,
    DETAIL_MIN_HORIZONTAL_GAP,
    DETAIL_TOP_GAP,
    EVENT_COLORS,
    EVENT_SPACING,
    HEAT_AXIS_GAP,
    HEAT_ROW_GAP,
    HEAT_ROW_HEIGHT,
    HEAT_TOP_Y,
    MIN_CANVAS_HEIGHT,
    TICK_COUNT,
    TIMELINE_GUARD_X,
    TIMELINE_TOP_PADDING,
} from './constants';
import type { TimelineGeometry, TimelineRenderedEvent } from './types';
import type { PersonaActivityEvent, TimelineWindowState } from '@/app/(main)/persona/types';
import { buildEventLabel, clamp, formatTickDate, getEventBoxSize, parseTimestamp, toRangeRatio } from './utils';

interface UseTimelineGeometryParams {
    events: PersonaActivityEvent[];
    windowState: TimelineWindowState;
    viewportWidth: number;
    timezone: string;
    includeInteractions: boolean;
}

interface UseTimelineGeometryResult {
    geometry: TimelineGeometry;
    renderedEvents: TimelineRenderedEvent[];
}

export function useTimelineGeometry({
    events,
    windowState,
    viewportWidth,
    timezone,
    includeInteractions,
}: UseTimelineGeometryParams): UseTimelineGeometryResult {
    return useMemo(() => {
        const startMs = windowState.start.getTime();
        const endMs = windowState.end.getTime();

        const viewportAxisWidth = viewportWidth > 0
            ? Math.max(0, viewportWidth - (AXIS_SIDE_PADDING * 2))
            : 0;
        const baseAxisWidth = Math.max(AXIS_MIN_WIDTH, viewportAxisWidth);
        const visibleCount = Math.max(events.length, 1);
        const densityAxisWidth = Math.max(baseAxisWidth, (visibleCount - 1) * EVENT_SPACING);
        const overflow = Math.max(0, densityAxisWidth - baseAxisWidth);

        // Keep axis anchored to the canvas guard and let scrollLeft absorb overflow changes.
        // This avoids double-applying overflow shifts that can push the right endpoint outside canvas bounds.
        const axisStartX = TIMELINE_GUARD_X;
        const axisEndX = axisStartX + densityAxisWidth;
        const canvasWidth = densityAxisWidth + (TIMELINE_GUARD_X * 2);

        const heatRowCount = includeInteractions ? 4 : 3;
        const heatHeight = (heatRowCount * HEAT_ROW_HEIGHT) + ((heatRowCount - 1) * HEAT_ROW_GAP);
        const axisY = HEAT_TOP_Y + heatHeight + HEAT_AXIS_GAP;
        const tickLabelY = TIMELINE_TOP_PADDING + 10;

        const ticks = Array.from({ length: TICK_COUNT }, (_, index) => {
            const ratio = index / (TICK_COUNT - 1);
            const x = axisStartX + (ratio * densityAxisWidth);
            const date = new Date(startMs + (ratio * Math.max(endMs - startMs, 1)));

            return {
                index,
                x,
                date,
                label: formatTickDate(date, timezone, windowState.durationDays),
            };
        });

        const eventsSorted = [...events].sort((a, b) => {
            const delta = parseTimestamp(a.createdAt) - parseTimestamp(b.createdAt);
            if (delta !== 0) return delta;
            return a.id.localeCompare(b.id);
        });

        const levelLastRight: number[] = [];
        const renderedEvents: TimelineRenderedEvent[] = [];
        let maxBottomY = axisY;
        const detailWidthScale = clamp(baseAxisWidth / Math.max(densityAxisWidth, 1), 0.72, 1);

        eventsSorted.forEach((event) => {
            const timestamp = parseTimestamp(event.createdAt);
            const ratio = toRangeRatio(timestamp, startMs, endMs);
            const markerX = axisStartX + (ratio * densityAxisWidth);
            const markerY = axisY;
            const color = EVENT_COLORS[event.type];
            const detailSize = getEventBoxSize(event.type, detailWidthScale);
            const unclampedLeft = markerX - (detailSize.width / 2);
            const detailLeft = clamp(
                unclampedLeft,
                axisStartX,
                axisEndX - detailSize.width
            );

            let level = 0;
            while (
                levelLastRight[level] !== undefined
                && detailLeft <= (levelLastRight[level] + DETAIL_MIN_HORIZONTAL_GAP)
            ) {
                level += 1;
            }

            levelLastRight[level] = detailLeft + detailSize.width;

            const detailTop = axisY + DETAIL_TOP_GAP + (level * (DETAIL_DEFAULT_HEIGHT + DETAIL_GAP));
            maxBottomY = Math.max(maxBottomY, detailTop + detailSize.height);

            renderedEvents.push({
                id: event.id,
                event,
                color,
                markerX,
                markerY,
                detailLeft,
                detailTop,
                detailWidth: detailSize.width,
                detailHeight: detailSize.height,
                detailLabel: buildEventLabel(event),
                level,
            });
        });

        const canvasHeight = Math.max(
            MIN_CANVAS_HEIGHT,
            maxBottomY + CANVAS_BOTTOM_GUARD
        );

        const geometry: TimelineGeometry = {
            axisStartX,
            axisEndX,
            axisWidth: densityAxisWidth,
            baseAxisWidth,
            densityAxisWidth,
            overflow,
            canvasWidth,
            canvasHeight,
            axisY,
            heatTopY: HEAT_TOP_Y,
            heatHeight,
            heatRowHeight: HEAT_ROW_HEIGHT,
            heatRowGap: HEAT_ROW_GAP,
            tickLabelY,
            dragRegionY: HEAT_TOP_Y - 10,
            dragRegionHeight: (axisY - (HEAT_TOP_Y - 10)) + 16,
            ticks,
        };

        return {
            geometry,
            renderedEvents,
        };
    }, [events, includeInteractions, timezone, viewportWidth, windowState.durationDays, windowState.end, windowState.start]);
}
