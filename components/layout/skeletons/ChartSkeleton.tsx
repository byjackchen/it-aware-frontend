'use client';

import { useTheme } from '@/lib/contexts/theme-context';

interface ChartSkeletonProps {
    height?: number;
}

export function ChartSkeleton({ height = 360 }: ChartSkeletonProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const surface = isLight ? 'bg-slate-200/60' : 'bg-white/5';

    return (
        <div
            className={`w-full rounded-xl animate-shimmer ${surface}`}
            style={{ height }}
        />
    );
}
