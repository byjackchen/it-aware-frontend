'use client';

/**
 * Shared MultiSelect primitive used by SidebarFilters and TopFilterBar.
 * Controlled component: owns only the open/closed popover + (optional)
 * search state; selection state lives in the parent.
 *
 * Optional features (all backward-compatible — existing callers don't
 * need to pass anything new):
 *   - `optionCount`: render a tabular-numbers count badge on the right
 *     of each option row (e.g. "AMER  8").
 *   - `searchable`: render a search input at the top of the popover
 *     and filter the option list as the user types. Useful when the
 *     option list can grow large (e.g. country lists).
 *   - **Grouping**: set a `group` field on each `SlicerOption` and the
 *     popover will render a sticky-style header each time the group
 *     changes. Options must be pre-sorted by group on input — the
 *     component does NOT reorder them.
 */

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

export interface SlicerOption {
    value: string;
    label: string;
    /**
     * Optional group label. When set on at least one option in the
     * list, the popover renders a sectioned view with a small header
     * each time the group label changes. Caller is responsible for
     * sorting options into group order before passing them in.
     */
    group?: string;
}

export interface MultiSelectProps {
    label: string;
    options: SlicerOption[];
    value: string[];
    onChange: (next: string[]) => void;
    /** Optional per-option counts; rendered as a trailing badge in the popover. */
    optionCount?: Record<string, number>;
    /** Show a search input at the top of the popover. */
    searchable?: boolean;
    searchPlaceholder?: string;
}

export function normaliseOptions(options: SlicerOption[] | string[]): SlicerOption[] {
    return options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt));
}

export function MultiSelect({
    label,
    options,
    value,
    onChange,
    optionCount,
    searchable = false,
    searchPlaceholder = 'Search…',
}: MultiSelectProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    // Close the popover when the user clicks outside the component
    // (anywhere else on the page, including chart areas, other
    // filters, etc.). The Escape key is also bound for keyboard users.
    const wrapRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!open) return;
        function onPointerDown(e: MouseEvent | TouchEvent) {
            const target = e.target as Node | null;
            if (wrapRef.current && target && !wrapRef.current.contains(target)) {
                setOpen(false);
            }
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const labelCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const subtleCls = isLight ? 'text-slate-400' : 'text-gray-500';
    const triggerCls = isLight
        ? 'bg-white border-slate-200 text-slate-800 hover:bg-slate-50'
        : 'bg-white/5 border-white/10 text-white hover:bg-white/10';
    const panelCls = isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-white/10';
    const itemHoverCls = isLight ? 'hover:bg-slate-100' : 'hover:bg-white/5';
    const selectedCls = isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-500/10 text-blue-300';
    const searchCls = isLight
        ? 'bg-white border-slate-200 text-slate-700 placeholder:text-slate-400'
        : 'bg-slate-900 border-white/10 text-gray-200 placeholder:text-gray-500';

    const selectedLabels = useMemo(
        () => value.map((v) => options.find((o) => o.value === v)?.label ?? v).slice(0, 2),
        [value, options],
    );

    const filteredOptions = useMemo(() => {
        if (!searchable || !search) return options;
        const q = search.toLowerCase();
        return options.filter(
            (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
        );
    }, [options, searchable, search]);

    function toggle(v: string) {
        if (value.includes(v)) onChange(value.filter((x) => x !== v));
        else onChange([...value, v]);
    }

    return (
        <div ref={wrapRef} className="relative flex flex-col gap-1">
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
                    className={`absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border shadow-lg max-h-72 overflow-hidden ${panelCls}`}
                >
                    {searchable && (
                        <div className={`relative p-1.5 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                            <Search
                                className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${subtleCls}`}
                            />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder={searchPlaceholder}
                                className={`w-full text-xs rounded-md border pl-7 pr-2 py-1 ${searchCls}`}
                                autoFocus
                            />
                        </div>
                    )}
                    <div className="max-h-56 overflow-auto">
                        {filteredOptions.length === 0 ? (
                            <div className={`text-xs px-3 py-2 ${labelCls}`}>
                                {options.length === 0 ? 'No options' : 'No matches'}
                            </div>
                        ) : (
                            (() => {
                                // Track the previous option's group so we can
                                // emit a header each time it changes.
                                let lastGroup: string | undefined;
                                const groupHeaderCls = isLight
                                    ? 'text-slate-500 bg-slate-50 border-slate-200'
                                    : 'text-gray-400 bg-white/[0.03] border-white/10';
                                return filteredOptions.map((opt) => {
                                    const selected = value.includes(opt.value);
                                    const count = optionCount?.[opt.value];
                                    const showHeader =
                                        opt.group !== undefined && opt.group !== lastGroup;
                                    if (opt.group !== undefined) lastGroup = opt.group;
                                    return (
                                        <Fragment key={opt.value}>
                                            {showHeader && (
                                                <div
                                                    className={`text-[10px] uppercase tracking-wider font-semibold px-3 py-1 border-y ${groupHeaderCls}`}
                                                >
                                                    {opt.group}
                                                </div>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => toggle(opt.value)}
                                                className={`w-full flex items-center gap-2 text-xs px-3 py-1.5 text-left ${itemHoverCls} ${selected ? selectedCls : ''}`}
                                            >
                                                <span className="w-3.5 h-3.5 shrink-0 inline-flex items-center justify-center">
                                                    {selected && <Check className="w-3 h-3" />}
                                                </span>
                                                <span className="truncate flex-1">{opt.label}</span>
                                                {count !== undefined && (
                                                    <span className={`tabular-nums ${subtleCls}`}>
                                                        {count.toLocaleString()}
                                                    </span>
                                                )}
                                            </button>
                                        </Fragment>
                                    );
                                });
                            })()
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
