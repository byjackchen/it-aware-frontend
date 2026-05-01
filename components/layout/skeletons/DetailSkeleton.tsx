'use client';

/**
 * Skeleton for detail pages (e.g., persona/[oid], data/agents/[oid]).
 * Header + tab strip + 2-column body.
 */

import { useTheme } from '@/lib/contexts/theme-context';

export function DetailSkeleton() {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const surface = isLight ? 'bg-slate-200/60' : 'bg-white/5';

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-full animate-shimmer ${surface}`} />
                <div className="flex-1 space-y-2">
                    <div className={`h-6 w-72 rounded animate-shimmer ${surface}`} />
                    <div className={`h-3 w-48 rounded animate-shimmer ${surface}`} />
                </div>
            </div>

            <div className="flex gap-3 mb-6">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`h-9 w-24 rounded animate-shimmer ${surface}`} />
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className={`h-16 rounded-lg animate-shimmer ${surface}`} />
                    ))}
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className={`h-24 rounded-lg animate-shimmer ${surface}`} />
                    ))}
                </div>
            </div>
        </div>
    );
}
