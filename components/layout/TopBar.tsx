'use client';

import { NavLink } from '@/components/navigation/NavLink';
import { Bell, Home, LogOut } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { TimezoneSelect } from '@/components/data/TimezoneSelect';
import { GlobalSearch } from '@/components/search';
import { useTranslations } from 'next-intl';
import { logout } from '@/app/actions/session';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useUser } from '@/lib/contexts/user-context';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';

/**
 * The top bar: the brand (goes to the person's start page), the home, the
 * search bar and the account controls. It has no menu: a person reaches a page
 * as a task, from search or from their home; a section's sidebar is unchanged.
 */

export function TopBar() {
  const t = useTranslations('TopBar');
  const router = useTransitionRouter();
  const { user, isLoading, clearUser } = useUser();
  const { theme } = useTheme();
  const { timezone, setTimezone } = useTimezone();
  const isLight = theme === 'light';

  // Use consistent initial value to avoid hydration mismatch
  const initials = !isLoading && user?.account?.username
    ? user.account.username
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
    <header
      className={`px-6 flex flex-col fixed top-[var(--env-banner-h,0px)] left-0 right-0 z-50 h-16 border-b transition-all duration-300 ease-in-out ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#0f0f23] border-white/10'
      }`}
    >
      {/* Main Navigation Row */}
      <div className="h-16 flex items-center justify-between gap-6 flex-shrink-0">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            {/* The logo goes to the person's start page; the house to their home. */}
            <NavLink href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 brand-mark rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">IA</span>
              </div>
              <span className={`text-xl font-semibold whitespace-nowrap ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('title')}</span>
            </NavLink>
            <NavLink
              href="/home"
              aria-label={t('home')}
              title={t('home')}
              className={`p-2 rounded-full transition-all duration-300 ${isLight ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-900/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
            >
              <Home className="w-5 h-5" />
            </NavLink>
          </div>
        </div>

        {/* Global Search - Center */}
        <GlobalSearch />

        <div className="flex items-center gap-4">
          <ThemeSwitcher />
          <LanguageSwitcher />
          <button className={`p-2 rounded-full transition-all duration-300 ${isLight ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-900/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
            <Bell className="w-5 h-5" />
          </button>

          {/* User Profile Dropdown */}
          <div className="relative group">
            <button className={`w-9 h-9 border rounded-full flex items-center justify-center font-medium text-sm transition-all duration-300 ${isLight ? 'bg-accent border-accent text-white hover:opacity-90' : 'bg-gradient-to-br from-blue-500/30 to-purple-500/30 hover:from-blue-500/50 hover:to-purple-500/50 border-white/20 text-white'}`}>
              {initials}
            </button>

            {/* Dropdown Menu */}
            <div className={`absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border shadow-2xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top-right ${isLight ? 'bg-white border-slate-200' : 'bg-[#0f0f23] border-white/10'}`}>
              <div className={`px-4 py-3 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                <p className={`text-sm font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                  {user?.worker?.full_name || user?.account?.username || '\u00A0'}
                </p>
                <p className={`text-sm truncate ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                  {user?.account?.username || '\u00A0'}
                </p>
                <p className={`text-xs truncate mt-1 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                  {user?.worker?.email || '\u00A0'}
                </p>
              </div>
              <div className={`px-4 py-3 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-2 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                  Timezone
                </p>
                <TimezoneSelect
                  value={timezone}
                  onChange={setTimezone}
                  allowEmpty={false}
                  placeholder="Select timezone..."
                />
                <p className={`text-xs mt-2 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                  Times shown in {timezone}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
