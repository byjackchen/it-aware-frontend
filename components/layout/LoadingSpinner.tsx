'use client';

/**
 * Reusable loading spinner component with size variants.
 * Theme-aware styling matching the app's design system.
 */

import { Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

interface LoadingSpinnerProps {
    size?: SpinnerSize;
    text?: string;
    className?: string;
    /** Full-page centered overlay */
    fullPage?: boolean;
}

const sizeClasses: Record<SpinnerSize, string> = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
};

const textSizeClasses: Record<SpinnerSize, string> = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg',
};

export function LoadingSpinner({
    size = 'md',
    text,
    className = '',
    fullPage = false,
}: LoadingSpinnerProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const spinner = (
        <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
            <Loader2
                className={`${sizeClasses[size]} animate-spin ${isLight ? 'text-blue-600' : 'text-blue-400'
                    }`}
            />
            {text && (
                <span
                    className={`${textSizeClasses[size]} ${isLight ? 'text-slate-600' : 'text-gray-400'
                        }`}
                >
                    {text}
                </span>
            )}
        </div>
    );

    if (fullPage) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
                {spinner}
            </div>
        );
    }

    return spinner;
}

/**
 * Page-level loading component for use in loading.tsx files.
 * Centers content in the available space.
 */
export function PageLoading({ text }: { text?: string }) {
    return (
        <div className="flex items-center justify-center min-h-[50vh]">
            <LoadingSpinner size="lg" text={text} />
        </div>
    );
}

/**
 * Skeleton loader for content placeholders.
 */
export function Skeleton({ className = '' }: { className?: string }) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    return (
        <div
            className={`animate-pulse rounded ${isLight ? 'bg-slate-200' : 'bg-white/10'
                } ${className}`}
        />
    );
}

/**
 * Table skeleton for data list loading states.
 */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-3 p-4">
            {/* Header */}
            <div className="flex gap-4 pb-2 border-b border-white/10">
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
                <Skeleton className="h-4 w-1/4" />
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex gap-4 py-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                </div>
            ))}
        </div>
    );
}
