'use client';

import { useLocale } from 'next-intl';
import { Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();

    const toggleLanguage = () => {
        const nextLocale = locale === 'en' ? 'zh' : 'en';

        // Set cookie for locale preference
        document.cookie = `IT_AWARE_LOCALE=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;

        // Refresh the page to apply new locale
        router.refresh();
    };

    return (
        <button
            onClick={toggleLanguage}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all duration-300 flex items-center gap-1"
            title={locale === 'en' ? 'Switch to Chinese' : 'Switch to English'}
        >
            <Globe className="w-5 h-5" />
            <span className="text-sm font-medium uppercase">{locale}</span>
        </button>
    );
}
