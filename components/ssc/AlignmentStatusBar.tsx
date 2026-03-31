'use client';

import { X } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';

interface AlignmentStatusBarProps {
    incidentStableId: string;
    windowStart: number;
    windowEnd: number;
    onClear: () => void;
}

function formatWindowTime(ts: number, timezone: string): string {
    const date = new Date(ts);
    return date.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
    });
}

export function AlignmentStatusBar({
    incidentStableId,
    windowStart,
    windowEnd,
    onClear,
}: AlignmentStatusBarProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';

    return (
        <div className={`flex items-center gap-2 px-4 py-2 text-xs border-t ${
            isLight ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
        }`}>
            <span className="text-blue-500">●</span>
            <span>
                Aligned to: <strong>{incidentStableId}</strong> — showing interactions from{' '}
                <strong>{formatWindowTime(windowStart, timezone)}</strong> to{' '}
                <strong>{formatWindowTime(windowEnd, timezone)}</strong> (30 min window)
            </span>
            <button
                onClick={onClear}
                className={`ml-auto flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
                    isLight ? 'hover:bg-blue-100 text-blue-600' : 'hover:bg-blue-500/20 text-blue-400'
                }`}
            >
                <X className="w-3 h-3" />
                Clear
            </button>
        </div>
    );
}
