'use client';

/**
 * Skeleton for list/table pages. Renders a filter-bar placeholder + N rows.
 */

import { useTheme } from '@/lib/contexts/theme-context';

interface ListSkeletonProps {
    rows?: number;
}

export function ListSkeleton({ rows = 8 }: ListSkeletonProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const surface = isLight ? 'bg-slate-200/60' : 'bg-white/5';

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-4">
                <div className={`h-8 w-56 rounded animate-shimmer ${surface}`} />
                <div className="flex gap-2">
                    <div className={`h-9 w-24 rounded animate-shimmer ${surface}`} />
                    <div className={`h-9 w-9 rounded animate-shimmer ${surface}`} />
                </div>
            </div>

            <div className={`h-12 rounded-lg mb-4 animate-shimmer ${surface}`} />

            <div className="space-y-2">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="grid grid-cols-12 gap-3 py-3">
                        <div className={`col-span-3 h-4 rounded animate-shimmer ${surface}`} />
                        <div className={`col-span-3 h-4 rounded animate-shimmer ${surface}`} />
                        <div className={`col-span-2 h-4 rounded animate-shimmer ${surface}`} />
                        <div className={`col-span-2 h-4 rounded animate-shimmer ${surface}`} />
                        <div className={`col-span-2 h-4 rounded animate-shimmer ${surface}`} />
                    </div>
                ))}
            </div>
        </div>
    );
}
