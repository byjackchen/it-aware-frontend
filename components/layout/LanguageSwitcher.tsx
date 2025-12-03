'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { Globe } from 'lucide-react';

export function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();

    const toggleLanguage = () => {
        const nextLocale = locale === 'en' ? 'zh' : 'en';
        router.replace(pathname, { locale: nextLocale });
    };

    return (
        <button
            onClick={toggleLanguage}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors flex items-center gap-1"
            title={locale === 'en' ? 'Switch to Chinese' : 'Switch to English'}
        >
            <Globe className="w-5 h-5" />
            <span className="text-sm font-medium uppercase">{locale}</span>
        </button>
    );
}
