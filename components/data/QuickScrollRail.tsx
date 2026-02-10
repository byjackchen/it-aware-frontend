'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsDown, ChevronsUp } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

const TRACK_HEIGHT = 224;
const THUMB_HEIGHT = 36;

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function readScrollMetrics() {
    const root = document.documentElement;
    const top = window.scrollY || root.scrollTop || 0;
    const max = Math.max(root.scrollHeight - window.innerHeight, 0);
    return { top, max };
}

export function QuickScrollRail() {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const trackRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLButtonElement>(null);
    const dragOffsetRef = useRef(0);
    const rafRef = useRef<number | null>(null);

    const [progress, setProgress] = useState(0);
    const [maxScroll, setMaxScroll] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const syncFromScroll = useCallback(() => {
        const { top, max } = readScrollMetrics();
        setMaxScroll(max);
        setProgress(max > 0 ? top / max : 0);
    }, []);

    const requestSync = useCallback(() => {
        if (rafRef.current !== null) return;
        rafRef.current = window.requestAnimationFrame(() => {
            rafRef.current = null;
            syncFromScroll();
        });
    }, [syncFromScroll]);

    const scrollToProgress = useCallback((next: number, behavior: ScrollBehavior = 'auto') => {
        const { max } = readScrollMetrics();
        const clamped = clamp(next, 0, 1);
        window.scrollTo({ top: max * clamped, behavior });
        setMaxScroll(max);
        setProgress(clamped);
    }, []);

    useEffect(() => {
        requestSync();

        const handleScroll = () => requestSync();
        const handleResize = () => requestSync();

        window.addEventListener('scroll', handleScroll, { passive: true });
        window.addEventListener('resize', handleResize);

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => requestSync())
            : null;
        if (resizeObserver) {
            resizeObserver.observe(document.body);
        }

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
            resizeObserver?.disconnect();
            if (rafRef.current !== null) {
                window.cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, [requestSync]);

    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (event: MouseEvent) => {
            const track = trackRef.current;
            if (!track) return;

            const rect = track.getBoundingClientRect();
            const usableHeight = rect.height - THUMB_HEIGHT;
            if (usableHeight <= 0) return;

            const offset = event.clientY - rect.top - dragOffsetRef.current;
            const ratio = offset / usableHeight;
            scrollToProgress(ratio);
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

    const thumbTop = useMemo(() => {
        const usableHeight = TRACK_HEIGHT - THUMB_HEIGHT;
        return usableHeight * progress;
    }, [progress]);

    if (maxScroll <= 0) return null;

    return (
        <div className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 lg:flex flex-col items-center gap-2">
            <button
                onClick={() => scrollToProgress(0, 'smooth')}
                className={`p-1.5 rounded-md transition-colors ${isLight ? 'bg-white text-slate-500 hover:bg-slate-100' : 'bg-slate-900/90 text-gray-300 hover:bg-slate-800'}`}
                aria-label="Scroll to top"
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
                onClick={() => scrollToProgress(1, 'smooth')}
                className={`p-1.5 rounded-md transition-colors ${isLight ? 'bg-white text-slate-500 hover:bg-slate-100' : 'bg-slate-900/90 text-gray-300 hover:bg-slate-800'}`}
                aria-label="Scroll to bottom"
            >
                <ChevronsDown className="w-4 h-4" />
            </button>
        </div>
    );
}
