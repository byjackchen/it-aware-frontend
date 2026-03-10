import type { PersonaActivityEvent, PersonaActivityEventType } from '@/app/(main)/persona/types';

export interface TimelineTick {
    index: number;
    x: number;
    date: Date;
    label: string;
}

export interface TimelineGeometry {
    axisStartX: number;
    axisEndX: number;
    axisWidth: number;
    baseAxisWidth: number;
    densityAxisWidth: number;
    overflow: number;
    canvasWidth: number;
    canvasHeight: number;
    axisY: number;
    heatTopY: number;
    heatHeight: number;
    heatRowHeight: number;
    heatRowGap: number;
    tickLabelY: number;
    dragRegionY: number;
    dragRegionHeight: number;
    ticks: TimelineTick[];
}

export interface TimelineRenderedEvent {
    id: string;
    event: PersonaActivityEvent;
    color: string;
    markerX: number;
    markerY: number;
    detailLeft: number;
    detailTop: number;
    detailWidth: number;
    detailHeight: number;
    detailLabel: string;
    level: number;
}

export interface TimelineHeatBin {
    index: number;
    startMs: number;
    endMs: number;
    incidentCount: number;
    requestCount: number;
    inquiryCount: number;
    interactionCount: number;
    surveyCount: number;
    analysisCount: number;
    totalCount: number;
    incidentIntensity: number;
    requestIntensity: number;
    inquiryIntensity: number;
    interactionIntensity: number;
    surveyIntensity: number;
    analysisIntensity: number;
}

export interface TimelineHoverPayload {
    x: number;
    y: number;
    label: string;
}

export interface TimelineDragSession {
    pointerId: number;
    startClientX: number;
    startStartMs: number;
    startEndMs: number;
    durationDays: number;
    axisWidth: number;
    lastShiftMs: number;
    didMove: boolean;
}

export type HeatType = PersonaActivityEventType;
