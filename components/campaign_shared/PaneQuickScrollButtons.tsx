'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ChevronsDown, ChevronsUp } from 'lucide-react';

const TRACK_HEIGHT = 224;
const THUMB_HEIGHT = 36;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

interface PaneQuickScrollButtonsProps {
    containerRef: RefObject<HTMLElement | null>;
    isLight: boolean;
}

export function PaneQuickScrollButtons({ containerRef, isLight }: PaneQuickScrollButtonsProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLButtonElement>(null);
    const dragOffsetRef = useRef(0);

    const [isVisible, setIsVisible] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const syncFromContainer = useCallback(() => {
        const container = containerRef.current;
        if (!container) {
            setIsVisible(false);
            setProgress(0);
            return;
        }

        const max = Math.max(container.scrollHeight - container.clientHeight, 0);
        const top = container.scrollTop;
        setIsVisible(max > 0);
        setProgress(max > 0 ? clamp(top / max, 0, 1) : 0);
    }, [containerRef]);

    const scrollToProgress = useCallback((next: number, behavior: ScrollBehavior = 'auto') => {
        const container = containerRef.current;
        if (!container) return;

        const max = Math.max(container.scrollHeight - container.clientHeight, 0);
        const clamped = clamp(next, 0, 1);
        container.scrollTo({ top: max * clamped, behavior });
        setIsVisible(max > 0);
        setProgress(max > 0 ? clamped : 0);
    }, [containerRef]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const rafId = window.requestAnimationFrame(syncFromContainer);
        container.addEventListener('scroll', syncFromContainer, { passive: true });
        window.addEventListener('resize', syncFromContainer);
        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => syncFromContainer())
            : null;
        resizeObserver?.observe(container);

        return () => {
            window.cancelAnimationFrame(rafId);
            container.removeEventListener('scroll', syncFromContainer);
            window.removeEventListener('resize', syncFromContainer);
            resizeObserver?.disconnect();
        };
    }, [containerRef, syncFromContainer]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (event: MouseEvent) => {
            const track = trackRef.current;
            if (!track) return;

            const rect = track.getBoundingClientRect();
            const usableHeight = rect.height - THUMB_HEIGHT;
            if (usableHeight <= 0) return;

            const offset = event.clientY - rect.top - dragOffsetRef.current;
            scrollToProgress(offset / usableHeight);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, scrollToProgress]);

    const atTop = progress <= 0.001;
    const atBottom = progress >= 0.999;
    const thumbTop = useMemo(() => {
        const usableHeight = TRACK_HEIGHT - THUMB_HEIGHT;
        return usableHeight * progress;
    }, [progress]);

    const containerClassName = `hidden lg:flex w-7 shrink-0 justify-center pt-2 ${isLight ? 'border-l border-slate-200/70' : 'border-l border-white/10'}`;

    const buttonClassName = `p-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isLight ? 'bg-white text-slate-500 hover:bg-slate-100' : 'bg-slate-900/90 text-gray-300 hover:bg-slate-800'}`;

    return (
        <div className={containerClassName}>
            {!isVisible ? null : (
                <div className="flex flex-col items-center gap-2">
                    <button
                        type="button"
                        disabled={atTop}
                        onClick={() => scrollToProgress(0, 'smooth')}
                        className={buttonClassName}
                        aria-label="Scroll list to top"
                    >
                        <ChevronsUp className="w-4 h-4" />
                    </button>

                    <div
                        ref={trackRef}
                        onMouseDown={(event) => {
                            const rect = event.currentTarget.getBoundingClientRect();
                            const usableHeight = rect.height - THUMB_HEIGHT;
                            if (usableHeight <= 0) return;
                            const ratio = (event.clientY - rect.top - THUMB_HEIGHT / 2) / usableHeight;
                            scrollToProgress(ratio);
                        }}
                        className={`relative h-56 w-2 rounded-full cursor-pointer ${isLight ? 'bg-slate-200' : 'bg-white/15'}`}
                        aria-hidden="true"
                    >
                        <button
                            type="button"
                            ref={thumbRef}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                const thumbRect = thumbRef.current?.getBoundingClientRect();
                                dragOffsetRef.current = thumbRect ? event.clientY - thumbRect.top : THUMB_HEIGHT / 2;
                                setIsDragging(true);
                            }}
                            className={`absolute left-1/2 w-4 -translate-x-1/2 rounded-full border transition-colors ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${isLight ? 'border-slate-300 bg-white hover:bg-slate-50' : 'border-white/20 bg-slate-900 hover:bg-slate-800'}`}
                            style={{ top: `${thumbTop}px`, height: `${THUMB_HEIGHT}px` }}
                            aria-label="Drag to scroll"
                        />
                    </div>

                    <button
                        type="button"
                        disabled={atBottom}
                        onClick={() => scrollToProgress(1, 'smooth')}
                        className={buttonClassName}
                        aria-label="Scroll list to bottom"
                    >
                        <ChevronsDown className="w-4 h-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
