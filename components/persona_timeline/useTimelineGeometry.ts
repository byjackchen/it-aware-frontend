import { useMemo } from 'react';
import {
    AXIS_MIN_WIDTH,
    CANVAS_BOTTOM_GUARD,
    DETAIL_DEFAULT_HEIGHT,
    DETAIL_DEFAULT_WIDTH,
    DETAIL_GAP,
    DETAIL_MIN_HORIZONTAL_GAP,
    DETAIL_TOP_GAP,
    EVENT_COLORS,
    HEAT_AXIS_GAP,
    HEAT_ROW_GAP,
    HEAT_ROW_HEIGHT,
    HEAT_TOP_Y,
    MIN_CANVAS_HEIGHT,
    SCENARIO_AXIS_GAP,
    SCENARIO_BOX_HEIGHT,
    SCENARIO_BOX_MIN_WIDTH,
    SCENARIO_TOP_Y,
    TICK_COUNT,
    TIMELINE_GUARD_X,
    TIMELINE_TOP_PADDING,
} from './constants';
import type { TimelineGeometry, TimelineRenderedEvent, TimelineScenarioBox } from './types';
import type { PersonaActivityEvent, TimelineWindowState } from '@/app/(main)/persona/types';
import type { ScenarioWithEdges } from '@/app/(main)/persona/usePersonaScenarios';
import { buildEventLabel, clamp, formatTickDate, getEventBoxSize, parseTimestamp, toRangeRatio } from './utils';

interface UseTimelineGeometryParams {
    events: PersonaActivityEvent[];
    windowState: TimelineWindowState;
    viewportWidth: number;
    timezone: string;
    includeInteractions: boolean;
    scenarios?: ScenarioWithEdges[];
}

interface UseTimelineGeometryResult {
    geometry: TimelineGeometry;
    renderedEvents: TimelineRenderedEvent[];
    scenarioBoxes: TimelineScenarioBox[];
}

export function useTimelineGeometry({
    events,
    windowState,
    viewportWidth,
    timezone,
    includeInteractions,
    scenarios,
}: UseTimelineGeometryParams): UseTimelineGeometryResult {
    return useMemo(() => {
        const startMs = windowState.start.getTime();
        const endMs = windowState.end.getTime();
        const canvasWidth = Math.max(
            viewportWidth > 0 ? viewportWidth : AXIS_MIN_WIDTH,
            (TIMELINE_GUARD_X * 2) + 320
        );
        const baseAxisWidth = canvasWidth - (TIMELINE_GUARD_X * 2);
        const visibleCount = Math.max(events.length, 1);
        const densityAxisWidth = baseAxisWidth;
        const axisStartX = TIMELINE_GUARD_X;
        const axisEndX = axisStartX + densityAxisWidth;
        const overflow = 0;

        // Determine if any scenario falls within the visible window
        const visibleScenarios = (scenarios || []).filter((s) => {
            const ts = parseTimestamp(s.effective_at);
            return ts >= startMs && ts <= endMs;
        });
        const scenarioRowHeight = visibleScenarios.length > 0
            ? SCENARIO_BOX_HEIGHT + SCENARIO_AXIS_GAP
            : 0;

        // Shift vertical positions down by scenarioRowHeight
        const adjustedHeatTopY = HEAT_TOP_Y + scenarioRowHeight;

        const heatRowCount = (includeInteractions ? 4 : 3) + 2;
        const heatHeight = (heatRowCount * HEAT_ROW_HEIGHT) + ((heatRowCount - 1) * HEAT_ROW_GAP);
        const axisY = adjustedHeatTopY + heatHeight + HEAT_AXIS_GAP;
        const tickLabelY = TIMELINE_TOP_PADDING + scenarioRowHeight + 10;

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

        // Compute scenario boxes
        const scenarioBoxes: TimelineScenarioBox[] = visibleScenarios.map((scenario) => {
            const ts = parseTimestamp(scenario.effective_at);
            const ratio = toRangeRatio(ts, startMs, endMs);
            const x = axisStartX + (ratio * densityAxisWidth);
            const label = scenario.scenario_type;
            const width = Math.max(SCENARIO_BOX_MIN_WIDTH, label.length * 9 + 24);

            // Find linked activity IDs by matching edges
            const linkedActivityIds: string[] = [];
            for (const edge of scenario.connectedEdges) {
                const otherOid = edge.from_oid === scenario.oid ? edge.to_oid : edge.from_oid;
                linkedActivityIds.push(otherOid);
            }

            return {
                scenarioOid: scenario.oid,
                scenarioType: scenario.scenario_type,
                effectiveAt: scenario.effective_at,
                x,
                y: SCENARIO_TOP_Y,
                width,
                height: SCENARIO_BOX_HEIGHT,
                label,
                href: `/data/scenarios/${scenario.oid}`,
                linkedActivityIds,
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
        const nominalSpacing = visibleCount > 1
            ? densityAxisWidth / (visibleCount - 1)
            : densityAxisWidth;
        const detailWidthScale = clamp(
            nominalSpacing / (DETAIL_DEFAULT_WIDTH * 0.95),
            0.48,
            1
        );

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
            heatTopY: adjustedHeatTopY,
            heatHeight,
            heatRowHeight: HEAT_ROW_HEIGHT,
            heatRowGap: HEAT_ROW_GAP,
            tickLabelY,
            dragRegionY: adjustedHeatTopY - 10,
            dragRegionHeight: (axisY - (adjustedHeatTopY - 10)) + 16,
            ticks,
            scenarioRowHeight,
        };

        return {
            geometry,
            renderedEvents,
            scenarioBoxes,
        };
    }, [events, includeInteractions, scenarios, timezone, viewportWidth, windowState.durationDays, windowState.end, windowState.start]);
}
