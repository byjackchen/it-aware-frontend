'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import type { Worker } from '@/lib/types/objects';
import type { TimelineWindowState } from './types';
import { usePersonaActivities } from './usePersonaActivities';
import { usePersonaScenarios } from './usePersonaScenarios';
import { TimelineControls } from '@/components/persona_timeline/TimelineControls';
import { TimelineLegend } from '@/components/persona_timeline/TimelineLegend';
import { TimelineCanvas } from '@/components/persona_timeline/TimelineCanvas';
import {
    TimelineBackgroundLoadingBadge,
    TimelineEmptyOverlay,
    TimelineErrorState,
    TimelineInitialLoadingState,
    TimelineNonBlockingErrorBadge,
} from '@/components/persona_timeline/TimelineStates';
import {
    DAY_MS,
} from '@/components/persona_timeline/constants';
import { useTimelineGeometry } from '@/components/persona_timeline/useTimelineGeometry';
import { useTimelineHeatBins } from '@/components/persona_timeline/useTimelineHeatBins';
import { useTimelineDragPan } from '@/components/persona_timeline/useTimelineDragPan';
import { buildWindow, clampWindowDays, formatExactTimestamp, formatHeatInterval } from '@/components/persona_timeline/utils';
import type { TimelineHeatBin, TimelineHoverPayload, TimelineScenarioBox } from '@/components/persona_timeline/types';

interface PersonaActivitiesTimelineProps {
    worker: Worker;
}

export function PersonaActivitiesTimeline({ worker }: PersonaActivitiesTimelineProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const t = useTranslations('Persona');
    const isLight = theme === 'light';

    const [windowState, setWindowState] = useState<TimelineWindowState>(() => buildWindow(30));
    const [showInteractions, setShowInteractions] = useState(true);
    const [viewportWidth, setViewportWidth] = useState(0);
    const [hover, setHover] = useState<TimelineHoverPayload | null>(null);

    const viewportRef = useRef<HTMLDivElement | null>(null);

    const {
        events,
        windowEvents,
        isInitialLoading,
        isBackgroundLoading,
        error,
        totalEvents,
        isTruncated,
        reload,
    } = usePersonaActivities(worker, windowState, showInteractions);

    const { scenarios } = usePersonaScenarios(worker);

    useEffect(() => {
        const element = viewportRef.current;
        if (!element) return;

        const updateWidth = () => {
            setViewportWidth(element.clientWidth);
        };

        updateWidth();

        const observer = new ResizeObserver(() => {
            updateWidth();
        });
        observer.observe(element);

        return () => {
            observer.disconnect();
        };
    }, []);

    const { geometry, renderedEvents, scenarioBoxes } = useTimelineGeometry({
        events,
        windowState,
        viewportWidth,
        timezone,
        includeInteractions: showInteractions,
        scenarios,
    });

    const { bins: heatBins, visibleTypes } = useTimelineHeatBins({
        events: windowEvents,
        windowState,
        axisWidth: geometry.axisWidth,
        includeInteractions: showInteractions,
    });

    const updateHoverPosition = useCallback((clientX: number, clientY: number, label: string) => {
        const viewport = viewportRef.current;
        if (!viewport) return;

        const rect = viewport.getBoundingClientRect();
        const rawX = clientX - rect.left + viewport.scrollLeft + 14;
        const rawY = clientY - rect.top + viewport.scrollTop - 20;
        const maxX = Math.max(8, viewport.scrollWidth - 360 - 8);

        setHover({
            x: Math.max(8, Math.min(rawX, maxX)),
            y: Math.max(8, rawY),
            label,
        });
    }, []);

    const handleEventHover = useCallback((event: React.MouseEvent, item: { type: string; createdAt: string }) => {
        const label = `${t(`timeline.lanes.${item.type}`)} • ${formatExactTimestamp(item.createdAt, timezone)}`;
        updateHoverPosition(event.clientX, event.clientY, label);
    }, [t, timezone, updateHoverPosition]);

    const handleHeatHover = useCallback((event: React.MouseEvent, bin: TimelineHeatBin) => {
        const label = [
            `${t('timeline.heatTooltip.interval')}: ${formatHeatInterval(bin.startMs, bin.endMs, timezone)}`,
            `${t('timeline.heatTooltip.total')}: ${bin.totalCount}`,
            `${t('timeline.heatTooltip.incident')}: ${bin.incidentCount}`,
            `${t('timeline.heatTooltip.request')}: ${bin.requestCount}`,
            `${t('timeline.heatTooltip.inquiry')}: ${bin.inquiryCount}`,
            `${t('timeline.heatTooltip.interaction')}: ${bin.interactionCount}`,
            `${t('timeline.heatTooltip.survey')}: ${bin.surveyCount}`,
            `${t('timeline.heatTooltip.analysis')}: ${bin.analysisCount}`,
        ].join('\n');
        updateHoverPosition(event.clientX, event.clientY, label);
    }, [t, timezone, updateHoverPosition]);

    const clearHover = useCallback(() => {
        setHover(null);
    }, []);

    const dragPan = useTimelineDragPan({
        axisWidth: geometry.axisWidth,
        windowState,
        onWindowChange: setWindowState,
        onDragStart: clearHover,
    });

    const handleEventClick = useCallback((event: { href: string }) => {
        if (dragPan.shouldSuppressClick()) {
            return;
        }
        window.open(event.href, '_blank', 'noopener');
    }, [dragPan]);

    const handleScenarioClick = useCallback((box: TimelineScenarioBox) => {
        if (dragPan.shouldSuppressClick()) {
            return;
        }
        window.open(box.href, '_blank', 'noopener');
    }, [dragPan]);

    const handleScenarioHover = useCallback((event: React.MouseEvent, box: TimelineScenarioBox) => {
        const label = t('timeline.scenarioTooltip', {
            type: box.scenarioType,
            date: formatExactTimestamp(box.effectiveAt, timezone),
        });
        updateHoverPosition(event.clientX, event.clientY, label);
    }, [t, timezone, updateHoverPosition]);

    const setPresetWindow = useCallback((days: number) => {
        clearHover();
        setWindowState(buildWindow(days));
    }, [clearHover]);

    const slideWindow = useCallback((direction: -1 | 1) => {
        clearHover();
        setWindowState((previous) => {
            const shiftMs = previous.durationDays * DAY_MS * 0.5 * direction;
            return {
                start: new Date(previous.start.getTime() + shiftMs),
                end: new Date(previous.end.getTime() + shiftMs),
                durationDays: previous.durationDays,
            };
        });
    }, [clearHover]);

    const zoomWindow = useCallback((direction: 'in' | 'out') => {
        clearHover();
        setWindowState((previous) => {
            const nextDays = direction === 'in'
                ? clampWindowDays(previous.durationDays / 2)
                : clampWindowDays(previous.durationDays * 2);
            const center = (previous.start.getTime() + previous.end.getTime()) / 2;
            const halfWindow = (nextDays * DAY_MS) / 2;

            return {
                start: new Date(center - halfWindow),
                end: new Date(center + halfWindow),
                durationDays: nextDays,
            };
        });
    }, [clearHover]);

    const handleReload = useCallback(() => {
        clearHover();
        reload();
    }, [clearHover, reload]);

    const toggleInteractions = useCallback(() => {
        clearHover();
        setShowInteractions((value) => !value);
    }, [clearHover]);

    return (
        <div className="space-y-3">
            <TimelineControls
                windowState={windowState}
                timezone={timezone}
                isLight={isLight}
                isReloading={isInitialLoading || isBackgroundLoading}
                showInteractions={showInteractions}
                t={t}
                onPresetWindow={setPresetWindow}
                onSlideWindow={slideWindow}
                onZoomWindow={zoomWindow}
                onReload={handleReload}
                onToggleInteractions={toggleInteractions}
            />

            <TimelineLegend
                isLight={isLight}
                showInteractions={showInteractions}
                t={t}
            />

            {isTruncated && (
                <div className={`text-xs ${isLight ? 'text-amber-700' : 'text-amber-400'}`}>
                    {t('timeline.showingLatest', { loaded: events.length, total: totalEvents })}
                </div>
            )}

            <div
                ref={viewportRef}
                onPointerDown={dragPan.onPointerDown}
                onPointerMove={dragPan.onPointerMove}
                onPointerUp={dragPan.onPointerUp}
                onPointerCancel={dragPan.onPointerCancel}
                onPointerLeave={dragPan.onPointerLeave}
                className={`
                    w-full rounded-xl border overflow-hidden relative select-none
                    ${dragPan.isDraggingWindow ? 'cursor-grabbing' : 'cursor-grab'}
                    ${isLight ? 'border-slate-200 bg-slate-50' : 'border-slate-700 bg-slate-950'}
                `}
            >
                {isInitialLoading && windowEvents.length === 0 ? (
                    <TimelineInitialLoadingState
                        isLight={isLight}
                        message={t('timeline.loading')}
                    />
                ) : error && windowEvents.length === 0 ? (
                    <TimelineErrorState
                        isLight={isLight}
                        message={t('timeline.error')}
                        retryLabel={t('timeline.retry')}
                        onRetry={handleReload}
                    />
                ) : (
                    <>
                        <TimelineCanvas
                            geometry={geometry}
                            renderedEvents={renderedEvents}
                            heatBins={heatBins}
                            visibleHeatTypes={visibleTypes}
                            windowState={windowState}
                            timezone={timezone}
                            isLight={isLight}
                            hover={hover}
                            t={t}
                            onEventClick={handleEventClick}
                            onEventHover={handleEventHover}
                            onHeatHover={handleHeatHover}
                            onClearHover={clearHover}
                            scenarioBoxes={scenarioBoxes}
                            onScenarioClick={handleScenarioClick}
                            onScenarioHover={handleScenarioHover}
                        />

                        {windowEvents.length === 0 && (
                            <TimelineEmptyOverlay
                                isLight={isLight}
                                message={t('timeline.empty')}
                            />
                        )}

                        {isBackgroundLoading && (
                            <TimelineBackgroundLoadingBadge
                                isLight={isLight}
                                message={t('timeline.backgroundLoading')}
                            />
                        )}

                        {error && windowEvents.length > 0 && (
                            <TimelineNonBlockingErrorBadge
                                isLight={isLight}
                                message={t('timeline.error')}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
