'use client';

/**
 * DonutLegend — interactive external legend for {@link DonutCard}.
 *
 * recharts' built-in `<Legend>` is presentational only; it cannot drive
 * cross-filtering. This component replaces it for cards that need the
 * legend to act as a multi-select.
 *
 * Visual contract paired with `DonutCard`'s interactive mode:
 *   - When `selected` is empty (no filter): every item is at full
 *     opacity. Donut slices behave the same (no white border).
 *   - When `selected` is non-empty: selected items keep full opacity
 *     (and the matching donut slice gets a white stroke). Unselected
 *     items dim to opacity 0.25 (swatch + label).
 *
 * Click handling toggles the slice; `onToggle` is called with the
 * slice name. The parent owns the `selected` state.
 */

import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';

export interface DonutLegendItem {
    name: string;
    value: number;
    color: string;
}

export interface DonutLegendProps {
    items: DonutLegendItem[];
    /** Selected slice names; empty array = "no filter" mode. */
    selected: string[];
    onToggle: (name: string) => void;
    /** Optional total — when set, items render their share as a % suffix. */
    total?: number;
    /** Override the dim opacity (default 0.25). */
    dimOpacity?: number;
}

export function DonutLegend({
    items,
    selected,
    onToggle,
    total,
    dimOpacity = 0.25,
}: DonutLegendProps) {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const labelCls = isLight ? 'text-slate-600' : 'text-gray-300';
    const dimTextCls = isLight ? 'text-slate-400' : 'text-gray-500';

    const noneSelected = selected.length === 0;

    return (
        <div
            role="group"
            aria-label={t('charts.filterLegend')}
            className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center pt-2"
        >
            {items.map((item) => {
                const isOn = noneSelected || selected.includes(item.name);
                const pct = total && total > 0 ? Math.round((item.value / total) * 100) : null;
                return (
                    <button
                        key={item.name}
                        type="button"
                        onClick={() => onToggle(item.name)}
                        aria-pressed={!noneSelected && selected.includes(item.name)}
                        className={`flex items-center gap-1.5 text-xs transition-opacity hover:opacity-90 ${labelCls}`}
                        style={{ opacity: isOn ? 1 : dimOpacity }}
                    >
                        <span
                            className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate max-w-[160px]">{item.name}</span>
                        <span className={`tabular-nums ${dimTextCls}`}>
                            {item.value.toLocaleString()}
                            {pct !== null && <> · {pct}%</>}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
