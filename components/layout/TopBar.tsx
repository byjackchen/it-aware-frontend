'use client';

import { Bell, LogOut } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslations } from 'next-intl';
import { logout } from '@/app/actions/auth';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/contexts/user-context';

export function TopBar() {
  const t = useTranslations('TopBar');
  const router = useRouter();
  const { user, isLoading, clearUser } = useUser();

  // Use consistent initial value to avoid hydration mismatch
  const initials = !isLoading && user?.username
    ? user.username
        .split('.')
        .map((part: string) => part.charAt(0).toUpperCase())
        .join('')
    : 'U';

  const handleLogout = async () => {
    clearUser();
    await logout();
    router.push('/login');
  };

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

        {/* User Profile Dropdown */}
        <div className="relative group">
          <button className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-800 font-medium text-sm hover:bg-gray-300 transition-colors">
            {initials}
          </button>

          {/* Dropdown Menu */}
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-100 py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.full_name || '\u00A0'}
              </p>
              <p className="text-sm text-gray-600 truncate">
                {user?.username || '\u00A0'}
              </p>
              <p className="text-xs text-gray-500 truncate mt-1">
                {user?.email || '\u00A0'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
