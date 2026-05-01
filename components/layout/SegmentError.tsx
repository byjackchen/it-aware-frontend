'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

interface SegmentErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
    title?: string;
}

export function SegmentError({ error, reset, title = 'Something went wrong' }: SegmentErrorProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    useEffect(() => {
        console.error('Segment error:', error);
    }, [error]);

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <div
                className={`max-w-md w-full rounded-xl p-6 shadow-xl border ${
                    isLight ? 'bg-white border-red-200' : 'bg-gray-800/50 border-red-500/30'
                }`}
            >
                <div
                    className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                        isLight ? 'bg-red-100' : 'bg-red-500/20'
                    }`}
                >
                    <AlertTriangle className={`w-8 h-8 ${isLight ? 'text-red-600' : 'text-red-400'}`} />
                </div>
                <h2 className={`text-xl font-semibold text-center mb-2 ${isLight ? 'text-gray-900' : 'text-white'}`}>
                    {title}
                </h2>
                <p className={`text-center mb-6 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>
                    {error.message || 'An unexpected error occurred.'}
                </p>
                {error.digest && (
                    <p className={`text-xs text-center mb-4 font-mono ${isLight ? 'text-gray-400' : 'text-gray-500'}`}>
                        Error ID: {error.digest}
                    </p>
                )}
                <button
                    onClick={reset}
                    className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg font-medium transition-colors ${
                        isLight ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
                    }`}
                >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                </button>
            </div>
        </div>
    );
}
