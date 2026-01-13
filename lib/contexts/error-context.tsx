'use client';

/**
 * Global error context for showing error toasts from anywhere in the app.
 * Provides showError() function to display error popups with detailed messages.
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ErrorToast, ErrorType } from '@/components/layout/ErrorToast';

interface ErrorInfo {
    id: string;
    message: string;
    type: ErrorType;
}

interface ErrorContextType {
    /** Show an error toast popup */
    showError: (message: string, type?: ErrorType) => void;
    /** Clear all error toasts */
    clearErrors: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
    const [errors, setErrors] = useState<ErrorInfo[]>([]);

    const showError = useCallback((message: string, type: ErrorType = 'unknown') => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setErrors((prev) => [...prev, { id, message, type }]);
    }, []);

    const clearErrors = useCallback(() => {
        setErrors([]);
    }, []);

    const removeError = useCallback((id: string) => {
        setErrors((prev) => prev.filter((e) => e.id !== id));
    }, []);

    return (
        <ErrorContext.Provider value={{ showError, clearErrors }}>
            {children}
            {/* Render error toasts */}
            <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-md w-full pointer-events-none">
                {errors.map((error, index) => (
                    <div
                        key={error.id}
                        style={{ transform: `translateY(${index * 8}px)` }}
                        className="pointer-events-auto"
                    >
                        <ErrorToast
                            message={error.message}
                            type={error.type}
                            onClose={() => removeError(error.id)}
                        />
                    </div>
                ))}
            </div>
        </ErrorContext.Provider>
    );
}

export function useError() {
    const context = useContext(ErrorContext);
    if (context === undefined) {
        throw new Error('useError must be used within an ErrorProvider');
    }
    return context;
}

/**
 * Helper to classify error messages into error types.
 */
export function classifyError(error: unknown): { message: string; type: ErrorType } {
    if (error instanceof Error) {
        const message = error.message.toLowerCase();

        // Auth-related errors
        if (
            message.includes('auth') ||
            message.includes('unauthorized') ||
            message.includes('forbidden') ||
            message.includes('session') ||
            message.includes('token') ||
            message.includes('login')
        ) {
            return { message: error.message, type: 'auth' };
        }

        // Network errors
        if (
            message.includes('network') ||
            message.includes('fetch') ||
            message.includes('connection') ||
            message.includes('timeout')
        ) {
            return { message: error.message, type: 'network' };
        }

        // API errors (has status code or "api" mention)
        if (message.includes('api') || /\b(4\d{2}|5\d{2})\b/.test(message)) {
            return { message: error.message, type: 'api' };
        }

        return { message: error.message, type: 'unknown' };
    }

    if (typeof error === 'string') {
        return { message: error, type: 'unknown' };
    }

    return { message: 'An unexpected error occurred', type: 'unknown' };
}
