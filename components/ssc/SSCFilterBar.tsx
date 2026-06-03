'use client';

import { Calendar, User } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { formatTzBadge } from '@/lib/utils/datetime';

interface SSCFilterBarProps {
    dateFrom: string;
    dateTo: string;
    workerFilter: string;
    timezone: string;
    onDateFromChange: (value: string) => void;
    onDateToChange: (value: string) => void;
    onWorkerFilterChange: (value: string) => void;
    onApply: () => void;
}

export function SSCFilterBar({
    dateFrom,
    dateTo,
    workerFilter,
    timezone,
    onDateFromChange,
    onDateToChange,
    onWorkerFilterChange,
    onApply,
}: SSCFilterBarProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const inputClass = `px-3 py-1.5 rounded-lg text-sm ${
        isLight
            ? 'bg-slate-100 text-slate-800 border border-slate-200'
            : 'bg-white/10 text-white border border-white/10'
    } focus:outline-none focus:ring-2 focus:ring-indigo-500/50`;

    const tzBadgeClass = `text-xs px-2 py-0.5 rounded-md font-mono ${
        isLight
            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
            : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
    }`;

    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-4 flex-wrap ${
            isLight ? 'bg-slate-50 border border-slate-200' : 'bg-white/5 border border-white/10'
        }`}>
            <div className="flex items-center gap-2 flex-wrap">
                <Calendar className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                <input
                    type="datetime-local"
                    step={1}
                    value={dateFrom}
                    onChange={(e) => onDateFromChange(e.target.value)}
                    className={inputClass}
                />
                <span className={`text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>to</span>
                <input
                    type="datetime-local"
                    step={1}
                    value={dateTo}
                    onChange={(e) => onDateToChange(e.target.value)}
                    className={inputClass}
                />
                <span
                    className={tzBadgeClass}
                    title="Filter window is interpreted in this timezone. Backend stores UTC; the offset is computed at submission time."
                >
                    {formatTzBadge(timezone)}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <User className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                <input
                    type="text"
                    value={workerFilter}
                    onChange={(e) => onWorkerFilterChange(e.target.value)}
                    placeholder="Worker stable_id..."
                    className={`${inputClass} w-48`}
                />
            </div>
            <button
                onClick={onApply}
                className="ml-auto px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
                Apply Filters
            </button>
        </div>
    );
}
