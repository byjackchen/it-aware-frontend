'use client';

import { useRouter } from 'next/navigation';
import { ShieldX, ArrowLeft, Home } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTranslations } from 'next-intl';

export default function AccessDeniedPage() {
    const router = useRouter();
    const { theme } = useTheme();
    const t = useTranslations('AccessDenied');
    const isLight = theme === 'light';

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <div
                className={`
                    max-w-md w-full rounded-xl p-6 shadow-xl border
                    ${isLight
                        ? 'bg-white border-amber-200'
                        : 'bg-gray-800/50 border-amber-500/30'
                    }
                `}
            >
                <div
                    className={`
                        mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4
                        ${isLight ? 'bg-amber-100' : 'bg-amber-500/20'}
                    `}
                >
                    <ShieldX
                        className={`w-8 h-8 ${isLight ? 'text-amber-600' : 'text-amber-400'}`}
                    />
                </div>

                <h2
                    className={`text-xl font-semibold text-center mb-2 ${isLight ? 'text-gray-900' : 'text-white'}`}
                >
                    {t('title')}
                </h2>

                <p
                    className={`text-center mb-6 ${isLight ? 'text-gray-600' : 'text-gray-400'}`}
                >
                    {t('message')}
                </p>

                <div className="flex gap-2">
                    <button
                        onClick={() => router.back()}
                        className={`
                            flex items-center justify-center gap-2 flex-1 py-2.5 px-4 rounded-lg
                            font-medium transition-colors
                            ${isLight
                                ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                : 'bg-white/10 hover:bg-white/20 text-gray-300'
                            }
                        `}
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {t('goBack')}
                    </button>

                    <button
                        onClick={() => router.push('/')}
                        className={`
                            flex items-center justify-center gap-2 flex-1 py-2.5 px-4 rounded-lg
                            font-medium transition-colors
                            ${isLight
                                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                                : 'bg-blue-500 hover:bg-blue-600 text-white'
                            }
                        `}
                    >
                        <Home className="w-4 h-4" />
                        {t('goHome')}
                    </button>
                </div>
            </div>
        </div>
    );
}
