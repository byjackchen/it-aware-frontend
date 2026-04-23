'use client';

/**
 * Shared MultiSelect primitive used by SidebarFilters and TopFilterBar.
 * Controlled component: owns only the open/closed popover state;
 * selection state lives in the parent.
 */

import { useMemo, useState } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

export interface SlicerOption {
    value: string;
    label: string;
}

export interface MultiSelectProps {
    label: string;
    options: SlicerOption[];
    value: string[];
    onChange: (next: string[]) => void;
}

export function normaliseOptions(options: SlicerOption[] | string[]): SlicerOption[] {
    return options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt));
}

export function MultiSelect({ label, options, value, onChange }: MultiSelectProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [open, setOpen] = useState(false);

    const labelCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const triggerCls = isLight
        ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
        : 'bg-white/5 border-white/10 text-white hover:bg-white/10';
    const panelCls = isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10';
    const itemHoverCls = isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5';
    const selectedCls = isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-500/10 text-blue-300';

    const selectedLabels = useMemo(
        () => value.map((v) => options.find((o) => o.value === v)?.label ?? v).slice(0, 2),
        [value, options],
    );

    function toggle(v: string) {
        if (value.includes(v)) onChange(value.filter((x) => x !== v));
        else onChange([...value, v]);
    }

    return (
        <div className="relative flex flex-col gap-1">
            <div className="flex items-center justify-between">
                <span className={`text-[11px] uppercase tracking-wide ${labelCls}`}>{label}</span>
                {value.length > 0 && (
                    <button
                        onClick={() => onChange([])}
                        className={`p-0.5 rounded ${isLight ? 'hover:bg-slate-100 text-slate-400' : 'hover:bg-white/10 text-gray-400'}`}
                        aria-label="Clear"
                    >
                        <X className="w-3 h-3" />
                    </button>
                )}
            </div>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`flex items-center justify-between gap-2 text-xs rounded-lg border px-2 py-1.5 ${triggerCls}`}
            >
                <span className="truncate">
                    {value.length === 0 ? (
                        <span className={labelCls}>All</span>
                    ) : value.length <= 2 ? (
                        selectedLabels.join(', ')
                    ) : (
                        `${selectedLabels.join(', ')} +${value.length - 2}`
                    )}
                </span>
                <ChevronDown className="w-3 h-3 shrink-0 opacity-60" />
            </button>
            {open && (
                <div
                    className={`absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border shadow-lg max-h-56 overflow-auto ${panelCls}`}
                >
                    {options.length === 0 ? (
                        <div className={`text-xs px-3 py-2 ${labelCls}`}>No options</div>
                    ) : (
                        options.map((opt) => {
                            const selected = value.includes(opt.value);
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => toggle(opt.value)}
                                    className={`w-full flex items-center gap-2 text-xs px-3 py-1.5 text-left ${itemHoverCls} ${selected ? selectedCls : ''}`}
                                >
                                    <span className="w-3.5 h-3.5 shrink-0 inline-flex items-center justify-center">
                                        {selected && <Check className="w-3 h-3" />}
                                    </span>
                                    <span className="truncate">{opt.label}</span>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
