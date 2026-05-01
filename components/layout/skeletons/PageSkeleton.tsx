'use client';

/**
 * Default route-level fallback. Renders a header + content area with shimmer.
 * Used by loading.tsx files at top-level segments that don't have a more
 * specific skeleton.
 */

import { useTheme } from '@/lib/contexts/theme-context';

interface PageSkeletonProps {
    title?: string;
    rows?: number;
}

export function PageSkeleton({ title, rows = 6 }: PageSkeletonProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const surface = isLight ? 'bg-slate-200/60' : 'bg-white/5';

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-xl animate-shimmer ${surface}`} />
                <div className="flex-1">
                    <div className={`h-6 w-48 rounded animate-shimmer ${surface}`} />
                    {title && (
                        <div className={`mt-2 h-3 w-32 rounded animate-shimmer ${surface}`} />
                    )}
                </div>
            </div>

            <div className="space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className={`h-12 rounded-lg animate-shimmer ${surface}`} />
                ))}
            </div>
        </div>
    );
}
