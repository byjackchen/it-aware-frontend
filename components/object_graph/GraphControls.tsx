'use client';

import { useCallback, useRef, useState } from 'react';
import { TYPE_COLORS, SLIDER_HANDLE_RADIUS } from './constants';
import { formatRangeDate } from './utils';
import type { EffectiveAtRange } from './types';

interface GraphControlsProps {
    linkedObjectTypes: string[];
    selectedFilter: string | null;
    onFilterChange: (objectType: string | null) => void;
    effectiveAtBounds: { min: Date; max: Date } | null;
    effectiveAtRange: EffectiveAtRange | null;
    onEffectiveAtRangeChange: (range: EffectiveAtRange | null) => void;
    isLight: boolean;
}

// Minimum gap between handles as a fraction of the total range (2%)
const MIN_GAP_RATIO = 0.02;

export function GraphControls({
    linkedObjectTypes,
    selectedFilter,
    onFilterChange,
    effectiveAtBounds,
    effectiveAtRange,
    onEffectiveAtRangeChange,
    isLight,
}: GraphControlsProps) {
    const trackRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<'from' | 'to' | null>(null);

    const rangeMs = effectiveAtBounds
        ? effectiveAtBounds.max.getTime() - effectiveAtBounds.min.getTime()
        : 0;

    // Minimum gap in ms between the two handles
    const minGapMs = rangeMs * MIN_GAP_RATIO;

    const pxToDate = useCallback(
        (clientX: number): Date => {
            if (!trackRef.current || !effectiveAtBounds || rangeMs === 0) return new Date();
            const rect = trackRef.current.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            return new Date(effectiveAtBounds.min.getTime() + ratio * rangeMs);
        },
        [effectiveAtBounds, rangeMs]
    );

    const dateToPercent = useCallback(
        (date: Date): number => {
            if (!effectiveAtBounds || rangeMs === 0) return 0;
            return ((date.getTime() - effectiveAtBounds.min.getTime()) / rangeMs) * 100;
        },
        [effectiveAtBounds, rangeMs]
    );

    const handlePointerDown = useCallback(
        (handle: 'from' | 'to') => (e: React.PointerEvent) => {
            e.preventDefault();
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            setDragging(handle);
        },
        []
    );

    const handlePointerMove = useCallback(
        (e: React.PointerEvent) => {
            if (!dragging || !effectiveAtBounds) return;
            const date = pxToDate(e.clientX);

            const current = effectiveAtRange ?? {
                from: effectiveAtBounds.min,
                to: effectiveAtBounds.max,
            };

            if (dragging === 'from') {
                // Clamp: must stay at least minGapMs before 'to', and within bounds
                const maxFromMs = current.to.getTime() - minGapMs;
                const clampedMs = Math.max(
                    effectiveAtBounds.min.getTime(),
                    Math.min(date.getTime(), maxFromMs)
                );
                onEffectiveAtRangeChange({ from: new Date(clampedMs), to: current.to });
            } else {
                // Clamp: must stay at least minGapMs after 'from', and within bounds
                const minToMs = current.from.getTime() + minGapMs;
                const clampedMs = Math.min(
                    effectiveAtBounds.max.getTime(),
                    Math.max(date.getTime(), minToMs)
                );
                onEffectiveAtRangeChange({ from: current.from, to: new Date(clampedMs) });
            }
        },
        [dragging, effectiveAtBounds, effectiveAtRange, pxToDate, onEffectiveAtRangeChange, minGapMs]
    );

    const handlePointerUp = useCallback(() => {
        setDragging(null);
    }, []);

    const fromDate = effectiveAtRange?.from ?? effectiveAtBounds?.min;
    const toDate = effectiveAtRange?.to ?? effectiveAtBounds?.max;
    const fromPercent = fromDate ? dateToPercent(fromDate) : 0;
    const toPercent = toDate ? dateToPercent(toDate) : 100;

    return (
        <div className="space-y-3">
            {/* Type filter */}
            {linkedObjectTypes.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        Filter:
                    </span>
                    <button
                        onClick={() => onFilterChange(null)}
                        className={`
                            px-2 py-1 text-xs rounded-md transition-colors
                            ${selectedFilter === null
                                ? 'bg-blue-500 text-white'
                                : isLight
                                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    : 'bg-white/10 text-gray-400 hover:bg-white/20'
                            }
                        `}
                    >
                        All
                    </button>
                    {linkedObjectTypes.map((objType) => {
                        const colors = TYPE_COLORS[objType] || TYPE_COLORS.default;
                        return (
                            <button
                                key={objType}
                                onClick={() => onFilterChange(objType)}
                                className={`
                                    px-2 py-1 text-xs rounded-md transition-colors flex items-center gap-1.5
                                    ${selectedFilter === objType
                                        ? 'text-white'
                                        : isLight
                                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                    }
                                `}
                                style={selectedFilter === objType ? { backgroundColor: colors.bg } : undefined}
                            >
                                <span
                                    className="w-2 h-2 rounded-full"
                                    style={{ backgroundColor: colors.bg }}
                                />
                                {objType}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Effective_at range slider */}
            {effectiveAtBounds && rangeMs > 0 && (
                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            Effective date range:
                        </span>
                        {effectiveAtRange && (
                            <button
                                onClick={() => onEffectiveAtRangeChange(null)}
                                className={`
                                    px-2 py-0.5 text-xs rounded transition-colors
                                    ${isLight
                                        ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/10'
                                    }
                                `}
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <div
                        className="relative select-none"
                        style={{ height: `${SLIDER_HANDLE_RADIUS * 2 + 8}px` }}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerUp}
                    >
                        {/* Track */}
                        <div
                            ref={trackRef}
                            className={`absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded-full ${
                                isLight ? 'bg-slate-200' : 'bg-slate-700'
                            }`}
                        />

                        {/* Active range */}
                        <div
                            className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-blue-500/40"
                            style={{
                                left: `${fromPercent}%`,
                                width: `${toPercent - fromPercent}%`,
                            }}
                        />

                        {/* From handle */}
                        <div
                            className={`absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-blue-500 ${
                                isLight ? 'bg-white' : 'bg-slate-800'
                            } ${dragging === 'from' ? 'ring-2 ring-blue-300' : ''}`}
                            style={{
                                left: `${fromPercent}%`,
                                width: `${SLIDER_HANDLE_RADIUS * 2}px`,
                                height: `${SLIDER_HANDLE_RADIUS * 2}px`,
                                marginLeft: `-${SLIDER_HANDLE_RADIUS}px`,
                                cursor: dragging === 'from' ? 'grabbing' : 'grab',
                                touchAction: 'none',
                                zIndex: dragging === 'from' ? 3 : 1,
                            }}
                            onPointerDown={handlePointerDown('from')}
                        />

                        {/* To handle */}
                        <div
                            className={`absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-blue-500 ${
                                isLight ? 'bg-white' : 'bg-slate-800'
                            } ${dragging === 'to' ? 'ring-2 ring-blue-300' : ''}`}
                            style={{
                                left: `${toPercent}%`,
                                width: `${SLIDER_HANDLE_RADIUS * 2}px`,
                                height: `${SLIDER_HANDLE_RADIUS * 2}px`,
                                marginLeft: `-${SLIDER_HANDLE_RADIUS}px`,
                                cursor: dragging === 'to' ? 'grabbing' : 'grab',
                                touchAction: 'none',
                                zIndex: dragging === 'to' ? 3 : 2,
                            }}
                            onPointerDown={handlePointerDown('to')}
                        />
                    </div>

                    {/* Date labels */}
                    <div className="flex items-center justify-between">
                        <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                            {fromDate ? formatRangeDate(fromDate) : ''}
                        </span>
                        <span className={`text-[10px] ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                            {toDate ? formatRangeDate(toDate) : ''}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
