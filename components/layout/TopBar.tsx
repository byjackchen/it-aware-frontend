import Link from 'next/link';
import { Bell, User } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslations } from 'next-intl';

export function TopBar() {
  const t = useTranslations('TopBar');

  return (
    <header className="h-16 border-b border-gray-200 bg-white px-6 flex items-center justify-between fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-lg">IT</span>
        </div>
        <span className="text-xl font-semibold text-gray-900">{t('title')}</span>
      </div>

      <div className="flex items-center gap-4">
        <LanguageSwitcher />
        <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600">
          <User className="w-5 h-5" />
        </div>
      </div>
    </header>
  );
}
