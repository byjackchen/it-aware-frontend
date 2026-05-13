'use client';

/**
 * AutoRefreshControl — right-aligned dropdown that lets the user choose an
 * auto-refresh interval for a dashboard. Intervals are bounded by product
 * requirement: minimum 5 minutes, maximum 1 hour.
 *
 * Design
 * ------
 * - Renders a compact pill-shaped trigger with a clock icon and the current
 *   selection (e.g. "5m"). When set to Off, the icon is greyed out.
 * - Clicking opens a small menu with Off / 5m / 10m / 15m / 30m / 1h.
 * - Parent owns the refetch logic — we just call `onRefresh()` on the
 *   chosen cadence. The component transparently handles tab visibility:
 *   when the tab is hidden we skip the tick, and trigger an immediate
 *   refresh on the first tick after the tab becomes visible again (only
 *   if the scheduled interval has already elapsed).
 * - Per-page selection is persisted to localStorage under `storageKey`
 *   so a user's cadence survives page reloads.
 *
 * Accessibility
 * -------------
 * - The trigger uses `aria-expanded` / `aria-haspopup`.
 * - Menu items are keyboard-focusable buttons.
 * - Click-outside and Escape close the menu.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Timer } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

export type AutoRefreshOption = {
    /** Label shown in the menu item (already-localised). */
    label: string;
    /** Short label shown in the trigger pill (already-localised). */
    short: string;
    /** Interval in milliseconds. Use 0 for "off". */
    value: number;
};

export interface AutoRefreshControlProps {
    /** Callback invoked when a tick fires. Should refetch the page data. */
    onRefresh: () => void | Promise<void>;
    /**
     * Unique per-page key used to persist the selected interval to
     * localStorage. E.g. `ops-dashboard:hub:auto-refresh`.
     */
    storageKey: string;
    /** Localised label text — "Auto refresh". */
    label?: string;
    /** Localised label for the "Off" option. */
    offLabel?: string;
    /** Override the default option set. Values must be 0 or 5–60 minutes. */
    options?: AutoRefreshOption[];
    /** Initial interval in milliseconds (used only if no persisted value). */
    defaultValue?: number;
}

/** Minimum allowed interval in ms (5 minutes). */
const MIN_INTERVAL_MS = 5 * 60 * 1000;
/** Maximum allowed interval in ms (1 hour). */
const MAX_INTERVAL_MS = 60 * 60 * 1000;

function buildDefaultOptions(offLabel: string): AutoRefreshOption[] {
    return [
        { label: offLabel, short: offLabel, value: 0 },
        { label: '5 min', short: '5m', value: 5 * 60 * 1000 },
        { label: '10 min', short: '10m', value: 10 * 60 * 1000 },
        { label: '15 min', short: '15m', value: 15 * 60 * 1000 },
        { label: '30 min', short: '30m', value: 30 * 60 * 1000 },
        { label: '1 hour', short: '1h', value: 60 * 60 * 1000 },
    ];
}

function clampInterval(ms: number): number {
    if (ms === 0) return 0;
    if (ms < MIN_INTERVAL_MS) return MIN_INTERVAL_MS;
    if (ms > MAX_INTERVAL_MS) return MAX_INTERVAL_MS;
    return ms;
}

function readPersisted(storageKey: string, fallback: number): number {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw === null) return fallback;
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) return fallback;
        return clampInterval(n);
    } catch {
        return fallback;
    }
}

function writePersisted(storageKey: string, value: number): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(storageKey, String(value));
    } catch {
        /* ignore */
    }
}

export function AutoRefreshControl({
    onRefresh,
    storageKey,
    label = 'Auto refresh',
    offLabel = 'Off',
    options,
    defaultValue = 0,
}: AutoRefreshControlProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const resolvedOptions = useMemo<AutoRefreshOption[]>(
        () => options ?? buildDefaultOptions(offLabel),
        [options, offLabel],
    );

    const [interval, setIntervalValue] = useState<number>(() =>
        readPersisted(storageKey, clampInterval(defaultValue)),
    );
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement | null>(null);

    // Keep the latest onRefresh callback without re-creating the timer.
    const onRefreshRef = useRef(onRefresh);
    useEffect(() => {
        onRefreshRef.current = onRefresh;
    }, [onRefresh]);

    // Timer wiring. Separate effect from state so changing onRefresh doesn't
    // reset the schedule.
    useEffect(() => {
        if (interval === 0) return;

        let lastRun = Date.now();

        const tick = () => {
            // Skip the tick when the tab is hidden — avoids piling up
            // network calls for a dashboard no one is looking at.
            if (typeof document !== 'undefined' && document.hidden) return;
            lastRun = Date.now();
            try {
                void onRefreshRef.current();
            } catch {
                /* caller is responsible for error surfacing */
            }
        };

        const handleVisibility = () => {
            if (typeof document === 'undefined' || document.hidden) return;
            if (Date.now() - lastRun >= interval) tick();
        };

        const handle = window.setInterval(tick, interval);
        document.addEventListener('visibilitychange', handleVisibility);
        return () => {
            window.clearInterval(handle);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [interval]);

    // Persist selection.
    useEffect(() => {
        writePersisted(storageKey, interval);
    }, [interval, storageKey]);

    // Click-outside / Escape to close.
    useEffect(() => {
        if (!open) return;
        const onDocClick = (e: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDocClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDocClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const active = interval > 0;
    const current =
        resolvedOptions.find((o) => o.value === interval) ?? resolvedOptions[0];

    const triggerCls = active
        ? isLight
            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
            : 'bg-indigo-500/15 border-indigo-400/40 text-indigo-200 hover:bg-indigo-500/25'
        : isLight
          ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10';

    const menuCls = isLight
        ? 'bg-white border-slate-200 text-slate-700 shadow-lg'
        : 'bg-slate-800 border-white/10 text-gray-200 shadow-xl';

    const itemCls = isLight
        ? 'hover:bg-slate-100'
        : 'hover:bg-white/10';

    const activeItemCls = isLight
        ? 'bg-indigo-50 text-indigo-700'
        : 'bg-indigo-500/20 text-indigo-200';

    return (
        <div ref={rootRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                aria-haspopup="menu"
                title={`${label}: ${current.label}`}
                className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-lg border text-xs font-medium transition-colors ${triggerCls}`}
            >
                <Timer className={`w-4 h-4 ${active ? '' : 'opacity-60'}`} />
                <span>{current.short}</span>
            </button>

            {open && (
                <div
                    role="menu"
                    className={`absolute right-0 top-full mt-1.5 z-30 min-w-[140px] rounded-lg border overflow-hidden ${menuCls}`}
                >
                    <div
                        className={`px-3 py-1.5 text-[11px] uppercase tracking-wide ${isLight ? 'text-slate-400' : 'text-gray-400'} border-b ${isLight ? 'border-slate-100' : 'border-white/5'}`}
                    >
                        {label}
                    </div>
                    {resolvedOptions.map((o) => {
                        const selected = o.value === interval;
                        return (
                            <button
                                key={o.value}
                                type="button"
                                role="menuitemradio"
                                aria-checked={selected}
                                onClick={() => {
                                    setIntervalValue(clampInterval(o.value));
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-3 ${itemCls} ${selected ? activeItemCls : ''}`}
                            >
                                <span>{o.label}</span>
                                {selected && <span aria-hidden>✓</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
