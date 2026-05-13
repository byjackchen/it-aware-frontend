'use client';

/**
 * TopFilterBar — collapsible filter strip rendered ABOVE the dashboard
 * content (not in a right column). Each dashboard page supplies its own
 * per-page slicer config; the bar is a controlled shell around
 * MultiSelect + DateRangePicker primitives.
 *
 * Collapse state
 * --------------
 * Defaults to expanded on first visit. If a ``storageKey`` prop is
 * supplied, the expanded/collapsed choice is persisted to localStorage
 * under that key (per-page) — so a user who prefers the collapsed
 * view keeps it after a refresh.
 *
 * Server- vs client-side slicers
 * ------------------------------
 * Phase 1 slicers are a mix: some drive the server fetch
 * (``assigned_group``, ``states_list``, ``priority``, etc.), some filter
 * the already-fetched rows in the browser (``actor.organization.descriptor``
 * as "Department", ``actor.location.descriptor`` as "Location").
 *
 * For client-side slicers, set ``clientSide: true`` on the SlicerConfig.
 * TopFilterBar renders a small info icon with a tooltip explaining that
 * the slicer narrows within the currently-fetched window — so users don't
 * wonder why widening the date range didn't already pull in older rows.
 *
 * FilterState shape matches SidebarFilters for drop-in replacement —
 * parents currently using SidebarFilters can swap imports.
 */

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { DateRangePicker, type DateRangeValue } from './DateRangePicker';
import { MultiSelect, normaliseOptions, type SlicerOption } from './MultiSelect';

export type SlicerConfig =
    | {
          type: 'multi';
          /** Backend param name (if server-driven) or client-side filter key. */
          param: string;
          label: string;
          options: SlicerOption[] | string[];
          /**
           * When true, renders an info icon + tooltip: filtering happens
           * in the browser over the fetched row set.
           */
          clientSide?: boolean;
      }
    | {
          type: 'date-range';
          /** Tuple of [from_param, to_param] — e.g. ['created_at_from', 'created_at_to']. */
          param: [string, string];
          label: string;
          clientSide?: boolean;
      };

/**
 * Slicer values keyed by param name. Same shape as SidebarFilters.
 * - 'multi' slicer       → string[]
 * - 'date-range' slicer  → { from: string | null; to: string | null }
 */
export type FilterState = Record<string, string[] | DateRangeValue>;

/**
 * A single subtitled section inside a combined filter bar. Each
 * section owns its own value + onChange pair because different sections
 * drive different server fetches (e.g. tickets vs. assets on the Hub).
 */
export interface FilterSection {
    subtitle: string;
    slicers: SlicerConfig[];
    value: FilterState;
    onChange: (next: FilterState) => void;
}

export interface TopFilterBarProps {
    /** Flat slicer list (single-section mode). Mutually exclusive with `sections`. */
    slicers?: SlicerConfig[];
    value?: FilterState;
    onChange?: (next: FilterState) => void;
    /**
     * Multi-section mode: render the card with N subtitled subsections.
     * Each section has its own filter state — used when a single page
     * drives multiple independent fetches (tickets + assets on the Hub).
     */
    sections?: FilterSection[];
    /**
     * Key used to persist expanded/collapsed state to localStorage.
     * Pass a stable per-page identifier (e.g. 'ops-dashboard:incidents').
     * If omitted, the bar is always expanded on mount.
     */
    storageKey?: string;
    /** Initial expanded state on first visit. Defaults to true. */
    defaultExpanded?: boolean;
    /** Title shown in the collapsed/expanded header. Defaults to 'Filters'. */
    title?: string;
    /** Localised label for the "Clear all" button. */
    clearLabel?: string;
    /**
     * Tooltip text for the client-side info icon. Pass a translated
     * string — falls back to an English default.
     */
    clientSideTooltip?: string;
    /**
     * Optional content rendered inside the expanded body, ABOVE the
     * slicer grid. Used to inject extra filter controls (e.g.
     * `RegionCountryFilter`) into the same panel without giving
     * TopFilterBar any opinion on what they are.
     */
    headerSlot?: React.ReactNode;
    /**
     * Hide the header-level "Clear all" link. Useful when a child
     * component (typically `headerSlot`) provides its own consolidated
     * clear-all button so the panel doesn't show two of them.
     */
    hideHeaderClear?: boolean;
    /**
     * Optional content rendered in the top-right of the panel header,
     * to the LEFT of the collapse / expand toggle. Page-level controls
     * (e.g. a consolidated "Clear All Filters" button) live here so
     * they're always visible regardless of expanded/collapsed state.
     */
    headerActions?: React.ReactNode;
}

function readPersisted(storageKey: string | undefined, fallback: boolean): boolean {
    if (!storageKey || typeof window === 'undefined') return fallback;
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw === 'expanded') return true;
        if (raw === 'collapsed') return false;
    } catch {
        /* localStorage disabled — ignore */
    }
    return fallback;
}

function writePersisted(storageKey: string | undefined, expanded: boolean): void {
    if (!storageKey || typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(storageKey, expanded ? 'expanded' : 'collapsed');
    } catch {
        /* ignore */
    }
}

function countActive(slicers: SlicerConfig[], value: FilterState): number {
    return slicers.reduce((acc, slicer) => {
        if (slicer.type === 'multi') {
            const v = value[slicer.param];
            return acc + (Array.isArray(v) ? v.length : 0);
        }
        const [fromParam] = slicer.param;
        const v = value[fromParam];
        if (v && !Array.isArray(v) && (v.from || v.to)) return acc + 1;
        return acc;
    }, 0);
}

function clearSlicers(slicers: SlicerConfig[]): FilterState {
    const cleared: FilterState = {};
    for (const slicer of slicers) {
        if (slicer.type === 'multi') cleared[slicer.param] = [];
        else {
            cleared[slicer.param[0]] = { from: null, to: null };
            cleared[slicer.param[1]] = { from: null, to: null };
        }
    }
    return cleared;
}

interface SectionGridProps {
    slicers: SlicerConfig[];
    value: FilterState;
    onChange: (next: FilterState) => void;
    clientSideTooltip: string;
}

function SectionGrid({ slicers, value, onChange, clientSideTooltip }: SectionGridProps) {
    function getMulti(param: string): string[] {
        const v = value[param];
        return Array.isArray(v) ? v : [];
    }

    function getRange(paramPair: [string, string]): DateRangeValue {
        const [fromParam] = paramPair;
        const v = value[fromParam];
        if (v && !Array.isArray(v)) return v;
        return { from: null, to: null };
    }

    const setMulti = (param: string, next: string[]) => {
        onChange({ ...value, [param]: next });
    };

    const setDateRange = (paramPair: [string, string], next: DateRangeValue) => {
        const [fromParam, toParam] = paramPair;
        onChange({
            ...value,
            [fromParam]: { from: next.from, to: next.to },
            [toParam]: { from: next.from, to: next.to },
        });
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {slicers.map((slicer) => {
                if (slicer.type === 'multi') {
                    const label = slicer.clientSide ? `${slicer.label} ⓘ` : slicer.label;
                    return (
                        <div
                            key={slicer.param}
                            title={slicer.clientSide ? clientSideTooltip : undefined}
                        >
                            <MultiSelect
                                label={label}
                                options={normaliseOptions(slicer.options)}
                                value={getMulti(slicer.param)}
                                onChange={(next) => setMulti(slicer.param, next)}
                            />
                        </div>
                    );
                }
                const drLabel = slicer.clientSide ? `${slicer.label} ⓘ` : slicer.label;
                return (
                    <div
                        key={slicer.param.join(':')}
                        title={slicer.clientSide ? clientSideTooltip : undefined}
                    >
                        <DateRangePicker
                            label={drLabel}
                            value={getRange(slicer.param)}
                            onChange={(next) => setDateRange(slicer.param, next)}
                        />
                    </div>
                );
            })}
        </div>
    );
}

export function TopFilterBar({
    slicers,
    value,
    onChange,
    sections,
    storageKey,
    defaultExpanded = true,
    title = 'Filters',
    clearLabel = 'Clear all',
    clientSideTooltip = 'Filters the currently loaded window. Widen the date range or clear other filters to see more options.',
    headerSlot,
    hideHeaderClear = false,
    headerActions,
}: TopFilterBarProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const [expanded, setExpanded] = useState<boolean>(() => readPersisted(storageKey, defaultExpanded));

    // Keep localStorage in sync when the user toggles.
    useEffect(() => {
        writePersisted(storageKey, expanded);
    }, [expanded, storageKey]);

    const cardCls = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5';
    const titleCls = isLight ? 'text-slate-800' : 'text-white';
    const mutedCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const subtitleCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const badgeCls = isLight ? 'bg-blue-50 text-blue-700' : 'bg-blue-500/10 text-blue-300';
    const btnCls = isLight
        ? 'border-slate-200 text-slate-700 hover:bg-slate-100'
        : 'border-white/10 text-gray-300 hover:bg-white/10';

    // Resolve to one code path: either a single flat section or N subtitled sections.
    const resolvedSections: FilterSection[] = sections
        ? sections
        : [
              {
                  subtitle: '',
                  slicers: slicers ?? [],
                  value: value ?? {},
                  onChange: onChange ?? (() => {}),
              },
          ];

    const activeCount = resolvedSections.reduce(
        (acc, s) => acc + countActive(s.slicers, s.value),
        0,
    );

    function clearAll() {
        for (const section of resolvedSections) {
            section.onChange(clearSlicers(section.slicers));
        }
    }

    return (
        <div className={`rounded-xl border ${cardCls}`}>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="flex items-center gap-2 text-left"
                    aria-expanded={expanded}
                >
                    <Filter className={`w-4 h-4 ${mutedCls}`} />
                    <span className={`text-sm font-semibold ${titleCls}`}>{title}</span>
                    {activeCount > 0 && (
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${badgeCls}`}>
                            {activeCount} active
                        </span>
                    )}
                </button>
                <div className="flex items-center gap-2">
                    {activeCount > 0 && !hideHeaderClear && (
                        <button
                            onClick={clearAll}
                            className={`text-xs underline decoration-dotted ${mutedCls}`}
                        >
                            {clearLabel}
                        </button>
                    )}
                    {headerActions}
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border ${btnCls}`}
                        aria-label={expanded ? 'Collapse filters' : 'Expand filters'}
                    >
                        {expanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                        ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                        )}
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="px-4 pb-4 pt-0 space-y-4">
                    {headerSlot}
                    {resolvedSections.map((section, idx) => (
                        <div key={section.subtitle || `section-${idx}`}>
                            {section.subtitle && (
                                <div
                                    className={`text-[11px] uppercase tracking-wide font-semibold mb-2 ${subtitleCls}`}
                                >
                                    {section.subtitle}
                                </div>
                            )}
                            <SectionGrid
                                slicers={section.slicers}
                                value={section.value}
                                onChange={section.onChange}
                                clientSideTooltip={clientSideTooltip}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
