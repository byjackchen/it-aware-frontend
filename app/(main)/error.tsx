'use client';

/**
 * Error boundary for the main layout.
 * Catches server-side errors and displays them in a toast popup.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw, ArrowLeft, Home } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
    const router = useRouter();
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // Log error for debugging
    useEffect(() => {
        console.error('Page error:', error);
    }, [error]);

    // Extract meaningful error message
    const getErrorMessage = () => {
        const message = error.message || 'An unexpected error occurred';

        // Check for common patterns
        if (message.includes('401') || message.includes('Unauthorized')) {
            return 'Your session has expired. Please log in again.';
        }
        if (message.includes('403') || message.includes('Forbidden')) {
            return 'You don\'t have permission to access this resource.';
        }
        if (message.includes('404') || message.includes('Not Found')) {
            return 'The requested resource was not found.';
        }
        if (message.includes('500') || message.includes('Internal Server')) {
            return 'A server error occurred. Please try again later.';
        }
        if (message.includes('fetch') || message.includes('network')) {
            return 'Network error. Please check your connection.';
        }

        return message;
    };

    const errorMessage = getErrorMessage();

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <div
                className={`
                    max-w-md w-full rounded-xl p-6 shadow-xl border
                    ${isLight
                        ? 'bg-white border-red-200'
                        : 'bg-gray-800/50 border-red-500/30'
                    }
                `}
            >
                {/* Icon */}
                <div
                    className={`
                        mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4
                        ${isLight ? 'bg-red-100' : 'bg-red-500/20'}
                    `}
                >
                    <AlertTriangle
                        className={`w-8 h-8 ${isLight ? 'text-red-600' : 'text-red-400'}`}
                    />
                </div>

                {/* Title */}
                <h2
                    className={`text-xl font-semibold text-center mb-2 ${isLight ? 'text-gray-900' : 'text-white'
                        }`}
                >
                    Something went wrong
                </h2>

                {/* Message */}
                <p
                    className={`text-center mb-6 ${isLight ? 'text-gray-600' : 'text-gray-400'
                        }`}
                >
                    {errorMessage}
                </p>

                {/* Error details (collapsible for debugging) */}
                {error.digest && (
                    <p
                        className={`text-xs text-center mb-4 font-mono ${isLight ? 'text-gray-400' : 'text-gray-500'
                            }`}
                    >
                        Error ID: {error.digest}
                    </p>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2">
                    <button
                        onClick={reset}
                        className={`
                            flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-lg
                            font-medium transition-colors
                            ${isLight
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }
                        `}
                    >
                        <RefreshCw className="w-4 h-4" />
                        Try Again
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={() => router.back()}
                            className={`
                                flex items-center justify-center gap-2 flex-1 py-2 px-3 rounded-lg
                                font-medium transition-colors
                                ${isLight
                                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    : 'bg-white/10 hover:bg-white/20 text-gray-300'
                                }
                            `}
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Go Back
                        </button>

                        <button
                            onClick={() => router.push('/')}
                            className={`
                                flex items-center justify-center gap-2 flex-1 py-2 px-3 rounded-lg
                                font-medium transition-colors
                                ${isLight
                                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                    : 'bg-white/10 hover:bg-white/20 text-gray-300'
                                }
                            `}
                        >
                            <Home className="w-4 h-4" />
                            Home
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
