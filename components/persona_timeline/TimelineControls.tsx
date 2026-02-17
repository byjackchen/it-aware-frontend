'use client';

import { CalendarClock, ChevronLeft, ChevronRight, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/datetime';
import type { TimelineWindowState } from '@/app/(main)/persona/types';
import { PRESET_WINDOWS } from './constants';

interface TimelineControlsProps {
    windowState: TimelineWindowState;
    timezone: string;
    isLight: boolean;
    isReloading: boolean;
    showInteractions: boolean;
    t: (key: string, values?: Record<string, string | number>) => string;
    onPresetWindow: (days: number) => void;
    onSlideWindow: (direction: -1 | 1) => void;
    onZoomWindow: (direction: 'in' | 'out') => void;
    onReload: () => void;
    onToggleInteractions: () => void;
}

export function TimelineControls({
    windowState,
    timezone,
    isLight,
    isReloading,
    showInteractions,
    t,
    onPresetWindow,
    onSlideWindow,
    onZoomWindow,
    onReload,
    onToggleInteractions,
}: TimelineControlsProps) {
    return (
        <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs font-medium uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('timeline.window')}
                </span>
                {PRESET_WINDOWS.map((days) => (
                    <button
                        key={days}
                        onClick={() => onPresetWindow(days)}
                        className={`
                            px-2 py-1 text-xs rounded-md transition-colors
                            ${windowState.durationDays === days
                                ? 'bg-blue-500 text-white'
                                : isLight
                                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}
                        `}
                    >
                        {days}D
                    </button>
                ))}
                <button
                    onClick={() => onSlideWindow(-1)}
                    className={`p-1.5 rounded-md ${isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    title={t('timeline.slideLeft')}
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onSlideWindow(1)}
                    className={`p-1.5 rounded-md ${isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    title={t('timeline.slideRight')}
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onZoomWindow('in')}
                    className={`p-1.5 rounded-md ${isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    title={t('timeline.zoomIn')}
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onZoomWindow('out')}
                    className={`p-1.5 rounded-md ${isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    title={t('timeline.zoomOut')}
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <button
                    onClick={onReload}
                    className={`p-1.5 rounded-md ${isLight ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    title={t('timeline.reload')}
                >
                    <RefreshCw className={`w-4 h-4 ${isReloading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="flex flex-col items-end gap-2">
                <button
                    onClick={onToggleInteractions}
                    className={`
                        px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                        ${showInteractions
                            ? 'bg-blue-500 text-white'
                            : isLight
                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}
                    `}
                >
                    {t('timeline.showInteractions')}: {showInteractions ? t('timeline.on') : t('timeline.off')}
                </button>
                <div className={`text-xs flex items-center gap-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    <CalendarClock className="w-4 h-4" />
                    <span>{formatDateTime(windowState.start, timezone)} → {formatDateTime(windowState.end, timezone)}</span>
                </div>
            </div>
        </div>
    );
}
