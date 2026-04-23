'use client';

/**
 * Minimal themed date-range picker built on native <input type="date">.
 *
 * Phase 1: no calendar popover, just two inputs side-by-side — matches
 * the ops prototype's filter bar density and keeps the dependency
 * surface small. We can upgrade to a richer popover later if the UX
 * calls for it.
 */

import { useTheme } from '@/lib/contexts/theme-context';

export interface DateRangeValue {
    from: string | null;
    to: string | null;
}

export interface DateRangePickerProps {
    label?: string;
    value: DateRangeValue;
    onChange: (next: DateRangeValue) => void;
    /** HTML `min` attribute for both inputs. */
    min?: string;
    /** HTML `max` attribute for both inputs. */
    max?: string;
}

export function DateRangePicker({ label, value, onChange, min, max }: DateRangePickerProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const inputCls = isLight
        ? 'bg-white border-slate-200 text-slate-800 placeholder-slate-400'
        : 'bg-white/5 border-white/10 text-white placeholder-gray-500';
    const labelCls = isLight ? 'text-slate-500' : 'text-gray-400';

    return (
        <div className="flex flex-col gap-1">
            {label && <span className={`text-[11px] uppercase tracking-wide ${labelCls}`}>{label}</span>}
            <div className="flex items-center gap-1.5">
                <input
                    type="date"
                    value={value.from ?? ''}
                    onChange={(e) => onChange({ ...value, from: e.target.value || null })}
                    min={min}
                    max={max}
                    className={`flex-1 text-xs rounded-lg border px-2 py-1 ${inputCls}`}
                />
                <span className={`text-xs ${labelCls}`}>–</span>
                <input
                    type="date"
                    value={value.to ?? ''}
                    onChange={(e) => onChange({ ...value, to: e.target.value || null })}
                    min={min}
                    max={max}
                    className={`flex-1 text-xs rounded-lg border px-2 py-1 ${inputCls}`}
                />
            </div>
        </div>
    );
}
