import { useCallback, useRef, useState } from 'react';
import { CLICK_SUPPRESS_MS, DRAG_SHIFT_MIN_MS } from './constants';
import type { TimelineDragSession } from './types';
import type { TimelineWindowState } from '@/app/(main)/persona/types';

interface UseTimelineDragPanParams {
    axisWidth: number;
    windowState: TimelineWindowState;
    onWindowChange: (next: TimelineWindowState) => void;
    onDragStart?: () => void;
}

interface UseTimelineDragPanResult {
    isDraggingWindow: boolean;
    shouldSuppressClick: () => boolean;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerLeave: (event: React.PointerEvent<HTMLDivElement>) => void;
}

export function useTimelineDragPan({
    axisWidth,
    windowState,
    onWindowChange,
    onDragStart,
}: UseTimelineDragPanParams): UseTimelineDragPanResult {
    const [isDraggingWindow, setIsDraggingWindow] = useState(false);
    const dragSessionRef = useRef<TimelineDragSession | null>(null);
    const suppressClickUntilRef = useRef(0);

    const shouldSuppressClick = useCallback(() => Date.now() < suppressClickUntilRef.current, []);

    const finishDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragSessionRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        if (drag.didMove) {
            suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS;
        }

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }

        dragSessionRef.current = null;
        setIsDraggingWindow(false);
    }, []);

    const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        if (event.button !== 0) return;
        if (axisWidth <= 0) return;

        const target = event.target as Element;
        const isDragRegion = target.closest('[data-timeline-drag-region="true"]');
        if (!isDragRegion) return;

        if (target.closest('[data-timeline-detail-card="true"]')) {
            return;
        }

        dragSessionRef.current = {
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startStartMs: windowState.start.getTime(),
            startEndMs: windowState.end.getTime(),
            durationDays: windowState.durationDays,
            axisWidth,
            lastShiftMs: 0,
            didMove: false,
        };

        event.currentTarget.setPointerCapture(event.pointerId);
        onDragStart?.();
        setIsDraggingWindow(true);
    }, [axisWidth, onDragStart, windowState.durationDays, windowState.end, windowState.start]);

    const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        const drag = dragSessionRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        const durationMs = Math.max(drag.startEndMs - drag.startStartMs, 1);
        const deltaX = event.clientX - drag.startClientX;
        const shiftMs = Math.round((deltaX / Math.max(drag.axisWidth, 1)) * durationMs);

        if (Math.abs(shiftMs - drag.lastShiftMs) < DRAG_SHIFT_MIN_MS) {
            return;
        }

        drag.didMove = true;
        drag.lastShiftMs = shiftMs;

        onWindowChange({
            start: new Date(drag.startStartMs + shiftMs),
            end: new Date(drag.startEndMs + shiftMs),
            durationDays: drag.durationDays,
        });
    }, [onWindowChange]);

    const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        finishDrag(event);
    }, [finishDrag]);

    const onPointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        finishDrag(event);
    }, [finishDrag]);

    const onPointerLeave = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
        finishDrag(event);
    }, [finishDrag]);

    return {
        isDraggingWindow,
        shouldSuppressClick,
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerCancel,
        onPointerLeave,
    };
}
