'use client';

/**
 * KpiCard — label, large headline number, optional delta / subtitle.
 *
 * Used across the 10 dashboard pages as the at-a-glance tile. Delta
 * rendering accepts both a computed sign (+/-/flat) so colour can be
 * picked in-component and a free-form subtitle for the prototype's
 * "vs. last 7 days" style copy.
 *
 * Pass `linkHref` to surface a small chevron-arrow on the right edge
 * of the card; clicking it navigates to that route via Next.js Link.
 * Used on the Active Monitoring Hub so KPI tiles like "Aging Incidents"
 * jump straight into the corresponding drill-in dashboard.
 */

import type { LucideIcon } from 'lucide-react';
import { ChevronRight, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';

export interface KpiCardProps {
    label: string;
    /** Pre-formatted value. Pass numbers via `value.toLocaleString()`. */
    value: string | number;
    subtitle?: string;
    /** Optional delta — rendered in green/red/neutral based on sign. */
    delta?: {
        value: string;
        trend: 'up' | 'down' | 'flat';
        /** If provided, a small ? icon next to the delta text reveals this on hover. */
        tooltip?: string;
    };
    icon?: LucideIcon;
    onClick?: () => void;
    /** Optional right-aligned ribbon (e.g. aging bucket count). */
    accent?: React.ReactNode;
    /**
     * Optional drill-in target — renders a chevron-right arrow on the
     * card's right edge that navigates to this route on click.
     */
    linkHref?: string;
    /** Tooltip / aria-label for the drill-in arrow. */
    linkLabel?: string;
    /** Extra Tailwind classes for the root card div (e.g. `h-full` for grid stretch). */
    className?: string;
    /** Optional definition / formula shown on hover as a tooltip next to the label. */
    tooltip?: React.ReactNode;
    /**
     * Headline number size — defaults to `md` (text-2xl). Pass `lg`
     * (text-4xl) or `xl` (text-5xl) for big-number tiles that share a
     * row with taller charts.
     */
    valueSize?: 'md' | 'lg' | 'xl';
    /**
     * Override the headline number's text colour. Use Tailwind colour
     * classes — e.g. `text-red-500` (red/warning when > 0) or
     * `text-green-500` (green/ok when = 0). Defaults to the neutral
     * slate/white colour driven by the theme.
     */
    valueColor?: string;
}

export function KpiCard({
    label,
    value,
    subtitle,
    delta,
    icon: Icon,
    onClick,
    accent,
    linkHref,
    linkLabel,
    className,
    valueSize = 'md',
    tooltip,
    valueColor,
}: KpiCardProps) {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const cardBase = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5';
    const hover = onClick ? (isLight ? 'hover:bg-slate-50 cursor-pointer' : 'hover:bg-white/10 cursor-pointer') : '';
    const labelCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const subtitleCls = isLight ? 'text-slate-500' : 'text-gray-500';
    const arrowCls = isLight
        ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
        : 'text-gray-500 hover:text-gray-200 hover:bg-white/10';

    // Delta colour follows the ops-dashboard "rising = warning, falling
    // = good" convention used by tickets / aging metrics:
    //   ▲ up    → orange (volume / aging is growing — heads-up)
    //   ▼ down  → green  (volume / aging shrinking — good)
    //   flat    → muted slate / gray
    const deltaCls =
        delta?.trend === 'up'
            ? 'text-orange-500'
            : delta?.trend === 'down'
                ? 'text-green-500'
                : isLight
                    ? 'text-slate-500'
                    : 'text-gray-400';

    const valueSizeCls =
        valueSize === 'xl' ? 'text-5xl' : valueSize === 'lg' ? 'text-4xl' : 'text-2xl';
    const valueColorCls = valueColor ?? (isLight ? 'text-slate-800' : 'text-white');

    return (
        <div
            onClick={onClick}
            className={`relative rounded-xl border p-4 transition-colors ${cardBase} ${hover} ${className ?? ''}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-1.5 min-w-0">
                    {Icon && <Icon className={`w-3.5 h-3.5 shrink-0 ${labelCls}`} />}
                    <p className={`text-[10px] uppercase tracking-wide truncate ${labelCls}`}>{label}</p>
                    {tooltip && (
                        <span className="group relative inline-flex shrink-0 items-center">
                            <HelpCircle className={`h-3 w-3 transition-colors ${isLight ? 'text-slate-400 group-hover:text-slate-700' : 'text-gray-500 group-hover:text-white'}`} />
                            <span className={`pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-lg border px-3 py-2 text-[11px] leading-5 shadow-lg group-hover:block ${isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/10 bg-slate-900 text-gray-300'}`}>
                                {tooltip}
                            </span>
                        </span>
                    )}
                </div>
                {accent}
            </div>
            <p className={`${valueSizeCls} font-bold mt-1.5 ${valueColorCls}`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {(delta || subtitle) && (
                <div className="flex items-center gap-2 mt-1">
                    {delta && (
                        <span className={`inline-flex items-center gap-1 text-xs font-medium ${deltaCls}`}>
                            {delta.value}
                            {delta.tooltip && (
                                <span className="group relative inline-flex items-center">
                                    <HelpCircle className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
                                    <span className={`pointer-events-none absolute left-1/2 bottom-full z-50 mb-2 hidden w-max max-w-[200px] -translate-x-1/2 rounded-lg border px-2.5 py-1.5 text-[11px] leading-4 shadow-lg group-hover:block ${isLight ? 'border-slate-200 bg-white text-slate-600' : 'border-white/10 bg-slate-900 text-gray-300'}`}>
                                        {delta.tooltip}
                                    </span>
                                </span>
                            )}
                        </span>
                    )}
                    {subtitle && <span className={`text-xs ${subtitleCls}`}>{subtitle}</span>}
                </div>
            )}
            {linkHref && (
                <Link
                    href={linkHref}
                    aria-label={linkLabel ?? t('links.openLabel', { label })}
                    title={linkLabel ?? t('links.openLabel', { label })}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute top-1/2 right-2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors ${arrowCls}`}
                >
                    <ChevronRight className="w-4 h-4" />
                </Link>
            )}
        </div>
    );
}
