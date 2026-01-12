'use client';

/**
 * Placeholder component for FAQ section (backend not ready yet).
 */

import { HelpCircle } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

export function EmptyFaqPlaceholder() {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    return (
        <div className={`
            flex flex-col items-center justify-center py-8 px-4 rounded-lg border-2 border-dashed
            ${isLight
                ? 'border-slate-200 bg-slate-50'
                : 'border-white/10 bg-white/5'
            }
        `}>
            <div className={`
                w-12 h-12 rounded-full flex items-center justify-center mb-3
                ${isLight
                    ? 'bg-slate-100 text-slate-400'
                    : 'bg-white/10 text-gray-500'
                }
            `}>
                <HelpCircle className="w-6 h-6" />
            </div>
            <p className={`
                text-sm font-medium
                ${isLight ? 'text-slate-600' : 'text-gray-400'}
            `}>
                FAQs Coming Soon
            </p>
            <p className={`
                text-xs mt-1
                ${isLight ? 'text-slate-400' : 'text-gray-500'}
            `}>
                This feature is under development
            </p>
        </div>
    );
}
