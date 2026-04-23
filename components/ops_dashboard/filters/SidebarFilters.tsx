'use client';

/**
 * SidebarFilters — left-sidebar slicer bar for dashboard pages.
 *
 * Accepts a declarative config of slicers (multi-select dropdowns +
 * date ranges) keyed by the corresponding backend param. The parent
 * owns the filter state; this component is a controlled shell.
 *
 * Phase 1 contract: slicer `options` are provided as static props by
 * the page (no distinct-values lookup endpoint exists yet). The
 * `actor_location_oid` / `actor_org_oid` slicers therefore pass OIDs
 * through directly — the page supplies the `{ value, label }` pairs.
 */

import { useMemo, useState } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { DateRangePicker, type DateRangeValue } from './DateRangePicker';

export interface SlicerOption {
    value: string;
    label: string;
}

export type SlicerConfig =
    | {
        type: 'multi';
        /** Backend param name (e.g. 'assigned_group'). */
        param: string;
        label: string;
        options: SlicerOption[] | string[];
    }
    | {
        type: 'date-range';
        /** Tuple of [from_param, to_param] — e.g. ['created_at_from', 'created_at_to']. */
        param: [string, string];
        label: string;
    };

/**
 * Slicer values keyed by param name.
 * - 'multi' slicer       → string[]
 * - 'date-range' slicer  → { from: string | null; to: string | null }
 */
export type FilterState = Record<string, string[] | DateRangeValue>;

export interface SidebarFiltersProps {
    slicers: SlicerConfig[];
    value: FilterState;
    onChange: (next: FilterState) => void;
    /** Optional "Clear all" button label. */
    clearLabel?: string;
}

function normaliseOptions(options: SlicerOption[] | string[]): SlicerOption[] {
    return options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt));
}

interface MultiSelectProps {
    label: string;
    options: SlicerOption[];
    value: string[];
    onChange: (next: string[]) => void;
}

function MultiSelect({ label, options, value, onChange }: MultiSelectProps) {
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
        () =>
            value
                .map((v) => options.find((o) => o.value === v)?.label ?? v)
                .slice(0, 2),
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

export function SidebarFilters({ slicers, value, onChange, clearLabel = 'Clear all' }: SidebarFiltersProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const titleCls = isLight ? 'text-slate-800' : 'text-white';
    const mutedCls = isLight ? 'text-slate-500' : 'text-gray-400';

    function setMulti(param: string, next: string[]) {
        onChange({ ...value, [param]: next });
    }

    function setDateRange(paramPair: [string, string], next: DateRangeValue) {
        const [fromParam, toParam] = paramPair;
        onChange({
            ...value,
            [fromParam]: { from: next.from, to: next.to },
            [toParam]: { from: next.from, to: next.to },
        });
    }

    function getMulti(param: string): string[] {
        const v = value[param];
        return Array.isArray(v) ? v : [];
    }

    function getRange(paramPair: [string, string]): DateRangeValue {
        // DateRangePickers write the same object to both keys; read
        // either one.
        const [fromParam] = paramPair;
        const v = value[fromParam];
        if (v && !Array.isArray(v)) return v;
        return { from: null, to: null };
    }

    const activeCount = slicers.reduce((acc, slicer) => {
        if (slicer.type === 'multi') {
            return acc + getMulti(slicer.param).length;
        }
        const range = getRange(slicer.param);
        return acc + (range.from || range.to ? 1 : 0);
    }, 0);

    function clearAll() {
        const cleared: FilterState = {};
        for (const slicer of slicers) {
            if (slicer.type === 'multi') cleared[slicer.param] = [];
            else {
                cleared[slicer.param[0]] = { from: null, to: null };
                cleared[slicer.param[1]] = { from: null, to: null };
            }
        }
        onChange(cleared);
    }

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h3 className={`text-sm font-semibold ${titleCls}`}>Filters</h3>
                {activeCount > 0 && (
                    <button
                        onClick={clearAll}
                        className={`text-xs underline decoration-dotted ${mutedCls}`}
                    >
                        {clearLabel}
                    </button>
                )}
            </div>

            {slicers.map((slicer) => {
                if (slicer.type === 'multi') {
                    return (
                        <MultiSelect
                            key={slicer.param}
                            label={slicer.label}
                            options={normaliseOptions(slicer.options)}
                            value={getMulti(slicer.param)}
                            onChange={(next) => setMulti(slicer.param, next)}
                        />
                    );
                }
                return (
                    <DateRangePicker
                        key={slicer.param.join(':')}
                        label={slicer.label}
                        value={getRange(slicer.param)}
                        onChange={(next) => setDateRange(slicer.param, next)}
                    />
                );
            })}
        </div>
    );
}
