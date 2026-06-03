import { useMemo } from 'react';
import { HEAT_BIN_MAX, HEAT_BIN_MIN, HEAT_BIN_PX, TIMELINE_TYPES } from './constants';
import type { TimelineHeatBin } from './types';
import type { PersonaActivityEvent, PersonaActivityEventType, TimelineWindowState } from '@/app/(main)/persona/types';
import { clamp, normalizeSqrt, parseTimestamp } from './utils';

interface UseTimelineHeatBinsParams {
    events: PersonaActivityEvent[];
    windowState: TimelineWindowState;
    axisWidth: number;
    includeInteractions: boolean;
}

interface UseTimelineHeatBinsResult {
    bins: TimelineHeatBin[];
    visibleTypes: PersonaActivityEventType[];
}

function incrementCount(bin: TimelineHeatBin, type: PersonaActivityEventType): void {
    switch (type) {
        case 'incident':
            bin.incidentCount += 1;
            break;
        case 'request':
            bin.requestCount += 1;
            break;
        case 'interaction':
            bin.interactionCount += 1;
            break;
        case 'survey':
            bin.surveyCount += 1;
            break;
        case 'analysis':
            bin.analysisCount += 1;
            break;
        default:
            break;
    }
    bin.totalCount += 1;
}

export function useTimelineHeatBins({
    events,
    windowState,
    axisWidth,
    includeInteractions,
}: UseTimelineHeatBinsParams): UseTimelineHeatBinsResult {
    return useMemo(() => {
        const visibleTypes: PersonaActivityEventType[] = includeInteractions
            ? [...TIMELINE_TYPES]
            : ['incident', 'request', 'survey', 'analysis'];

        const startMs = windowState.start.getTime();
        const endMs = windowState.end.getTime();
        const rangeMs = Math.max(endMs - startMs, 1);

        const adaptiveCount = Math.floor(axisWidth / HEAT_BIN_PX);
        const binCount = clamp(adaptiveCount, HEAT_BIN_MIN, HEAT_BIN_MAX);
        const binMs = rangeMs / binCount;

        const bins: TimelineHeatBin[] = Array.from({ length: binCount }, (_, index) => {
            const bucketStart = startMs + (index * binMs);
            const bucketEnd = index === (binCount - 1)
                ? endMs
                : Math.min(endMs, bucketStart + binMs);

            return {
                index,
                startMs: Math.floor(bucketStart),
                endMs: Math.floor(bucketEnd),
                incidentCount: 0,
                requestCount: 0,
                interactionCount: 0,
                surveyCount: 0,
                analysisCount: 0,
                totalCount: 0,
                incidentIntensity: 0,
                requestIntensity: 0,
                interactionIntensity: 0,
                surveyIntensity: 0,
                analysisIntensity: 0,
            };
        });

        events.forEach((event) => {
            if (!includeInteractions && event.type === 'interaction') {
                return;
            }

            const timestamp = parseTimestamp(event.createdAt);
            if (timestamp < startMs || timestamp > endMs) {
                return;
            }

            const ratio = (timestamp - startMs) / rangeMs;
            const index = clamp(Math.floor(ratio * binCount), 0, binCount - 1);
            incrementCount(bins[index], event.type);
        });

        const maxIncident = bins.reduce((max, bin) => Math.max(max, bin.incidentCount), 0);
        const maxRequest = bins.reduce((max, bin) => Math.max(max, bin.requestCount), 0);
        const maxInteraction = bins.reduce((max, bin) => Math.max(max, bin.interactionCount), 0);
        const maxSurvey = bins.reduce((max, bin) => Math.max(max, bin.surveyCount), 0);
        const maxAnalysis = bins.reduce((max, bin) => Math.max(max, bin.analysisCount), 0);

        bins.forEach((bin) => {
            bin.incidentIntensity = normalizeSqrt(bin.incidentCount, maxIncident);
            bin.requestIntensity = normalizeSqrt(bin.requestCount, maxRequest);
            bin.interactionIntensity = normalizeSqrt(bin.interactionCount, maxInteraction);
            bin.surveyIntensity = normalizeSqrt(bin.surveyCount, maxSurvey);
            bin.analysisIntensity = normalizeSqrt(bin.analysisCount, maxAnalysis);
        });

        return {
            bins,
            visibleTypes,
        };
    }, [axisWidth, events, includeInteractions, windowState.end, windowState.start]);
}
