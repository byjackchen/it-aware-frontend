'use client';

/**
 * Slide-out drawer component for displaying detail views.
 * Uses right-side slide animation with click-outside-to-close.
 */

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    width?: 'md' | 'lg' | 'xl';
}

const widthClasses = {
    md: 'w-[480px]',
    lg: 'w-[640px]',
    xl: 'w-[800px]',
};

export function Drawer({ isOpen, onClose, title, children, width = 'lg' }: DrawerProps) {
    const handleEscape = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        },
        [onClose]
    );

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleEscape]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div
                className={`relative ${widthClasses[width]} max-w-full h-full glass-dark border-l border-white/10 shadow-2xl animate-slide-in-right overflow-y-auto`}
            >
                {/* Header */}
                {title && (
                    <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-inherit">
                        <h2 className="text-lg font-semibold text-white">{title}</h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                )}

                {/* Content */}
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
}
