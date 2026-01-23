'use client';

/**
 * Dropdown for selecting location type.
 */

import { useTheme } from '@/lib/contexts/theme-context';
import { Building2, Globe, MapPin, Home, Building } from 'lucide-react';
import type { LocationType } from '@/lib/types/objects';

interface LocationTypeSelectProps {
    value: LocationType;
    onChange: (type: LocationType) => void;
    disabled?: boolean;
}

const LOCATION_TYPES: { value: LocationType; label: string; icon: typeof Building2; description: string }[] = [
    { value: 'root', label: 'Root hierarchy node', icon: Globe, description: 'Top-level location' },
    { value: 'region', label: 'Geographic region', icon: Globe, description: 'Regional grouping (e.g., EMEA, APAC)' },
    { value: 'country', label: 'Country', icon: MapPin, description: 'Country-level location' },
    { value: 'office_location', label: 'Physical office', icon: Building2, description: 'Physical office location' },
    { value: 'remote_location', label: 'Remote work location', icon: Home, description: 'Remote work location' },
];

export function LocationTypeSelect({ value, onChange, disabled }: LocationTypeSelectProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    return (
        <div className="space-y-2">
            {LOCATION_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = value === type.value;
                return (
                    <button
                        key={type.value}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange(type.value)}
                        className={`
                            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
                            ${isSelected
                                ? isLight
                                    ? 'bg-blue-50 border-2 border-blue-500 text-blue-700'
                                    : 'bg-blue-500/20 border-2 border-blue-500 text-blue-300'
                                : isLight
                                    ? 'bg-slate-50 border-2 border-transparent hover:bg-slate-100 text-slate-700'
                                    : 'bg-white/5 border-2 border-transparent hover:bg-white/10 text-gray-300'
                            }
                            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                    >
                        <div className={`
                            w-8 h-8 rounded-lg flex items-center justify-center
                            ${isSelected
                                ? isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/30 text-blue-400'
                                : isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-gray-500'
                            }
                        `}>
                            <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                            <div className={`text-sm font-medium ${isSelected ? '' : isLight ? 'text-slate-800' : 'text-white'}`}>
                                {type.label}
                            </div>
                            <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {type.description}
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
