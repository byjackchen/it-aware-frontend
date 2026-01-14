'use client';

import { useTranslations } from 'next-intl';
import { LayoutDashboard } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';

export default function DashboardPage() {
    const t = useTranslations('Dashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    return (
        <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
            <div className={`text-center space-y-4 p-8 rounded-2xl border ${isLight
                    ? 'bg-white/50 border-slate-200'
                    : 'bg-white/5 border-white/10'
                }`}>
                <div className={`w-16 h-16 mx-auto rounded-2xl flex items-center justify-center ${isLight
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                    <LayoutDashboard className="w-8 h-8" />
                </div>
                <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'
                    }`}>
                    {t('comingSoon')}
                </h1>
            </div>
        </div>
    );
}
