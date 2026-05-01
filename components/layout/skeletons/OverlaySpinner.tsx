'use client';

/**
 * Centered overlay spinner for blocking client-side actions
 * (export, save, bulk delete). Use sparingly: prefer a route transition.
 */

import { LoadingSpinner } from '@/components/layout/LoadingSpinner';

interface OverlaySpinnerProps {
    text?: string;
    progress?: number; // 0..100, optional. Renders below the spinner.
}

export function OverlaySpinner({ text, progress }: OverlaySpinnerProps) {
    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 px-6 py-5 rounded-xl bg-[var(--card-bg)] border border-[var(--border-color)]">
                <LoadingSpinner size="lg" text={text} />
                {typeof progress === 'number' && (
                    <div className="w-56 h-1.5 rounded bg-white/10 overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-[width] duration-200 ease-out"
                            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
