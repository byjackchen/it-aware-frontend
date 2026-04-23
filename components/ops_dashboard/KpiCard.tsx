'use client';

/**
 * KpiCard — label, large headline number, optional delta / subtitle.
 *
 * Used across the 10 dashboard pages as the at-a-glance tile. Delta
 * rendering accepts both a computed sign (+/-/flat) so colour can be
 * picked in-component and a free-form subtitle for the prototype's
 * "vs. last 7 days" style copy.
 */

import type { LucideIcon } from 'lucide-react';
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
    };
    icon?: LucideIcon;
    onClick?: () => void;
    /** Optional right-aligned ribbon (e.g. aging bucket count). */
    accent?: React.ReactNode;
}

export function KpiCard({ label, value, subtitle, delta, icon: Icon, onClick, accent }: KpiCardProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const cardBase = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5';
    const hover = onClick ? (isLight ? 'hover:bg-slate-50 cursor-pointer' : 'hover:bg-white/10 cursor-pointer') : '';
    const labelCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const valueCls = isLight ? 'text-slate-800' : 'text-white';
    const subtitleCls = isLight ? 'text-slate-500' : 'text-gray-500';

    const deltaCls =
        delta?.trend === 'up'
            ? 'text-green-500'
            : delta?.trend === 'down'
                ? 'text-red-500'
                : isLight
                    ? 'text-slate-500'
                    : 'text-gray-400';

    return (
        <div
            onClick={onClick}
            className={`rounded-xl border p-4 transition-colors ${cardBase} ${hover}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-1.5 min-w-0">
                    {Icon && <Icon className={`w-3.5 h-3.5 ${labelCls}`} />}
                    <p className={`text-[10px] uppercase tracking-wide truncate ${labelCls}`}>{label}</p>
                </div>
                {accent}
            </div>
            <p className={`text-2xl font-bold mt-1.5 ${valueCls}`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {(delta || subtitle) && (
                <div className="flex items-center gap-2 mt-1">
                    {delta && <span className={`text-xs font-medium ${deltaCls}`}>{delta.value}</span>}
                    {subtitle && <span className={`text-xs ${subtitleCls}`}>{subtitle}</span>}
                </div>
            )}
        </div>
    );
}
