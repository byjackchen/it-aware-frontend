'use client';

/**
 * TitleWithInfo — shared card-header primitive used across the ops-dashboard
 * chart components. Renders a title that is intentionally terse (KPI-label
 * length) with an optional hover tooltip carrying the long-form definition.
 *
 * Matches the style already used by KpiCard (HelpCircle icon + on-hover
 * popover) so every card on the dashboard behaves the same way.
 */

import { HelpCircle } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

export interface TitleWithInfoProps {
    title: string;
    /** Optional secondary line rendered below the title (smaller, muted). */
    subtitle?: string;
    /** Definition / formula shown on hover in a small popover beside the title. */
    info?: string;
}

export function TitleWithInfo({ title, subtitle, info }: TitleWithInfoProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const titleCls = isLight ? 'text-slate-800' : 'text-white';
    const subtitleCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const iconIdleCls = isLight ? 'text-slate-400' : 'text-gray-500';
    const iconHoverCls = isLight ? 'group-hover:text-slate-700' : 'group-hover:text-white';
    const popoverCls = isLight
        ? 'border-slate-200 bg-white text-slate-600'
        : 'border-white/10 bg-slate-900 text-gray-300';

    return (
        <div className="min-w-0">
            <h3 className={`text-sm font-medium flex items-center gap-1.5 ${titleCls}`}>
                <span className="truncate">{title}</span>
                {info && (
                    <span className="group relative inline-flex shrink-0 items-center">
                        <HelpCircle className={`h-3.5 w-3.5 transition-colors ${iconIdleCls} ${iconHoverCls}`} />
                        <span
                            className={`pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-56 -translate-x-1/2 rounded-lg border px-3 py-2 text-[11px] leading-5 shadow-lg group-hover:block ${popoverCls}`}
                        >
                            {info}
                        </span>
                    </span>
                )}
            </h3>
            {subtitle && <p className={`text-xs mt-0.5 ${subtitleCls}`}>{subtitle}</p>}
        </div>
    );
}
