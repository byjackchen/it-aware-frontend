'use client';

/**
 * Error toast popup component.
 * Displays error messages with auto-dismiss and manual close.
 */

import { useEffect, useState } from 'react';
import { X, AlertCircle, AlertTriangle, WifiOff, ShieldX } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

export type ErrorType = 'auth' | 'api' | 'network' | 'unknown';

export interface ErrorToastProps {
    message: string;
    type?: ErrorType;
    onClose: () => void;
    /** Auto dismiss after ms (0 = no auto dismiss) */
    duration?: number;
}

const errorIcons: Record<ErrorType, typeof AlertCircle> = {
    auth: ShieldX,
    api: AlertCircle,
    network: WifiOff,
    unknown: AlertTriangle,
};

const errorTitles: Record<ErrorType, string> = {
    auth: 'Authentication Error',
    api: 'API Error',
    network: 'Network Error',
    unknown: 'Error',
};

export function ErrorToast({
    message,
    type = 'unknown',
    onClose,
    duration = 8000,
}: ErrorToastProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const [isVisible, setIsVisible] = useState(true);
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                handleClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            setIsVisible(false);
            onClose();
        }, 300);
    };

    if (!isVisible) return null;

    const Icon = errorIcons[type];

    return (
        <div
            className={`
                fixed top-4 right-4 z-[100] max-w-md w-full
                transform transition-all duration-300 ease-out
                ${isExiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
            `}
        >
            <div
                className={`
                    flex items-start gap-3 p-4 rounded-lg shadow-xl border
                    ${isLight
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-red-900/40 border-red-500/30 text-red-100'
                    }
                `}
            >
                <Icon
                    className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isLight ? 'text-red-600' : 'text-red-400'
                        }`}
                />
                <div className="flex-1 min-w-0">
                    <p
                        className={`font-semibold text-sm ${isLight ? 'text-red-800' : 'text-red-200'
                            }`}
                    >
                        {errorTitles[type]}
                    </p>
                    <p
                        className={`text-sm mt-1 ${isLight ? 'text-red-700' : 'text-red-300'
                            }`}
                    >
                        {message}
                    </p>
                </div>
                <button
                    onClick={handleClose}
                    className={`
                        p-1 rounded-full transition-colors flex-shrink-0
                        ${isLight
                            ? 'hover:bg-red-200 text-red-600'
                            : 'hover:bg-red-800 text-red-400'
                        }
                    `}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
