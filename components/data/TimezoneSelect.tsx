'use client';

/**
 * Searchable dropdown for selecting IANA timezones.
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Clock, X } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

interface TimezoneSelectProps {
    value: string;
    onChange: (timezone: string) => void;
    disabled?: boolean;
    allowEmpty?: boolean; // Allow empty string for non-timezone-sensitive locations
    placeholder?: string;
}

// Common IANA timezones grouped by region
const TIMEZONE_GROUPS: { region: string; timezones: { id: string; label: string; offset: string }[] }[] = [
    {
        region: 'Americas',
        timezones: [
            { id: 'America/New_York', label: 'New York (ET)', offset: 'UTC-5/-4' },
            { id: 'America/Chicago', label: 'Chicago (CT)', offset: 'UTC-6/-5' },
            { id: 'America/Denver', label: 'Denver (MT)', offset: 'UTC-7/-6' },
            { id: 'America/Los_Angeles', label: 'Los Angeles (PT)', offset: 'UTC-8/-7' },
            { id: 'America/Toronto', label: 'Toronto', offset: 'UTC-5/-4' },
            { id: 'America/Vancouver', label: 'Vancouver', offset: 'UTC-8/-7' },
            { id: 'America/Sao_Paulo', label: 'São Paulo', offset: 'UTC-3' },
            { id: 'America/Mexico_City', label: 'Mexico City', offset: 'UTC-6/-5' },
        ],
    },
    {
        region: 'Europe',
        timezones: [
            { id: 'Europe/London', label: 'London', offset: 'UTC+0/+1' },
            { id: 'Europe/Paris', label: 'Paris', offset: 'UTC+1/+2' },
            { id: 'Europe/Berlin', label: 'Berlin', offset: 'UTC+1/+2' },
            { id: 'Europe/Amsterdam', label: 'Amsterdam', offset: 'UTC+1/+2' },
            { id: 'Europe/Madrid', label: 'Madrid', offset: 'UTC+1/+2' },
            { id: 'Europe/Rome', label: 'Rome', offset: 'UTC+1/+2' },
            { id: 'Europe/Zurich', label: 'Zurich', offset: 'UTC+1/+2' },
            { id: 'Europe/Stockholm', label: 'Stockholm', offset: 'UTC+1/+2' },
        ],
    },
    {
        region: 'Asia Pacific',
        timezones: [
            { id: 'Asia/Tokyo', label: 'Tokyo', offset: 'UTC+9' },
            { id: 'Asia/Shanghai', label: 'Shanghai', offset: 'UTC+8' },
            { id: 'Asia/Hong_Kong', label: 'Hong Kong', offset: 'UTC+8' },
            { id: 'Asia/Singapore', label: 'Singapore', offset: 'UTC+8' },
            { id: 'Asia/Seoul', label: 'Seoul', offset: 'UTC+9' },
            { id: 'Asia/Mumbai', label: 'Mumbai', offset: 'UTC+5:30' },
            { id: 'Asia/Dubai', label: 'Dubai', offset: 'UTC+4' },
            { id: 'Australia/Sydney', label: 'Sydney', offset: 'UTC+10/+11' },
            { id: 'Australia/Melbourne', label: 'Melbourne', offset: 'UTC+10/+11' },
            { id: 'Pacific/Auckland', label: 'Auckland', offset: 'UTC+12/+13' },
        ],
    },
    {
        region: 'Other',
        timezones: [
            { id: 'Africa/Johannesburg', label: 'Johannesburg', offset: 'UTC+2' },
            { id: 'Africa/Lagos', label: 'Lagos', offset: 'UTC+1' },
            { id: 'Africa/Cairo', label: 'Cairo', offset: 'UTC+2' },
            { id: 'UTC', label: 'UTC', offset: 'UTC+0' },
        ],
    },
];

// Flatten for easy lookup
const ALL_TIMEZONES = TIMEZONE_GROUPS.flatMap((g) => g.timezones);

export function TimezoneSelect({
    value,
    onChange,
    disabled,
    allowEmpty = true,
    placeholder = 'Select timezone...',
}: TimezoneSelectProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Find selected timezone info
    const selectedTimezone = ALL_TIMEZONES.find((tz) => tz.id === value);

    // Filter timezones by search
    const filteredGroups = useMemo(() => {
        if (!search) return TIMEZONE_GROUPS;
        const lower = search.toLowerCase();
        return TIMEZONE_GROUPS.map((group) => ({
            ...group,
            timezones: group.timezones.filter(
                (tz) =>
                    tz.id.toLowerCase().includes(lower) ||
                    tz.label.toLowerCase().includes(lower)
            ),
        })).filter((group) => group.timezones.length > 0);
    }, [search]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus input when opening
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    const handleSelect = (timezoneId: string) => {
        onChange(timezoneId);
        setIsOpen(false);
        setSearch('');
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Trigger button */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left
                    ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Clock className={`w-4 h-4 flex-shrink-0 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                    {value === '' && allowEmpty ? (
                        <span className={isLight ? 'text-slate-500' : 'text-gray-400'}>
                            No timezone (regions/countries)
                        </span>
                    ) : selectedTimezone ? (
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="truncate">{selectedTimezone.label}</span>
                            <span className={`text-xs flex-shrink-0 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                {selectedTimezone.offset}
                            </span>
                        </div>
                    ) : (
                        <span className={isLight ? 'text-slate-400' : 'text-gray-500'}>{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div
                    className={`
                        absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden
                        ${isLight ? 'bg-white border-slate-200' : 'bg-gray-800 border-white/10'}
                    `}
                >
                    {/* Search input */}
                    <div className={`p-2 border-b ${isLight ? 'border-slate-100' : 'border-white/10'}`}>
                        <div className="relative">
                            <Search
                                className={`absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}
                            />
                            <input
                                ref={inputRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search timezones..."
                                className={`
                                    w-full pl-8 pr-3 py-1.5 rounded-md text-sm
                                    ${isLight
                                        ? 'bg-slate-100 text-slate-800 placeholder:text-slate-400'
                                        : 'bg-white/10 text-white placeholder:text-gray-500'
                                    }
                                `}
                            />
                        </div>
                    </div>

                    {/* Options list */}
                    <div className="max-h-64 overflow-y-auto">
                        {/* Empty timezone option */}
                        {allowEmpty && !search && (
                            <button
                                type="button"
                                onClick={() => handleSelect('')}
                                className={`
                                    w-full flex items-center gap-2 px-3 py-2 text-sm text-left
                                    ${value === ''
                                        ? isLight
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'bg-blue-500/20 text-blue-400'
                                        : isLight
                                            ? 'hover:bg-slate-50 text-slate-600'
                                            : 'hover:bg-white/5 text-gray-300'
                                    }
                                `}
                            >
                                <X className="w-3.5 h-3.5" />
                                <span>No timezone (for regions/countries)</span>
                            </button>
                        )}

                        {/* Grouped timezones */}
                        {filteredGroups.map((group) => (
                            <div key={group.region}>
                                <div
                                    className={`px-3 py-1.5 text-xs font-medium sticky top-0 ${isLight
                                        ? 'bg-slate-50 text-slate-500'
                                        : 'bg-gray-700 text-gray-400'
                                        }`}
                                >
                                    {group.region}
                                </div>
                                {group.timezones.map((tz) => (
                                    <button
                                        key={tz.id}
                                        type="button"
                                        onClick={() => handleSelect(tz.id)}
                                        className={`
                                            w-full flex items-center justify-between px-3 py-2 text-sm text-left
                                            ${value === tz.id
                                                ? isLight
                                                    ? 'bg-blue-50 text-blue-600'
                                                    : 'bg-blue-500/20 text-blue-400'
                                                : isLight
                                                    ? 'hover:bg-slate-50 text-slate-700'
                                                    : 'hover:bg-white/5 text-gray-200'
                                            }
                                        `}
                                    >
                                        <span>{tz.label}</span>
                                        <span
                                            className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}
                                        >
                                            {tz.offset}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ))}

                        {/* No results */}
                        {filteredGroups.length === 0 && (
                            <div className={`px-3 py-4 text-sm text-center ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                No timezones found
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
