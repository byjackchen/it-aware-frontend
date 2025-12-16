'use client';

import Link from 'next/link';
import { Bell, BookOpen, Database, LogOut, Shield, UserCircle } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { useTranslations } from 'next-intl';
import { logout } from '@/app/actions/auth';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/lib/contexts/user-context';
import { useTheme } from '@/lib/contexts/theme-context';
import { useMenuAuthorization } from './AuthorizedMenuItem';
import { PERMISSIONS } from '@/lib/config/permissions';
import { type MenuItem, requireAnyPermission } from '@/lib/types/menu';

export function TopBar() {
  const t = useTranslations('TopBar');
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, clearUser } = useUser();
  const { theme } = useTheme();
  const { checkMenuAccess } = useMenuAuthorization();
  const isLight = theme === 'light';

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

  // Navigation items with permission requirements
  // Security menu requires either 'auth:all:read' OR 'auth:all:edit'
  // Persona menu requires either 'persona:all:read' OR 'persona:all:edit'
  const navItems: MenuItem[] = [
    {
      href: '/auth',
      label: t('auth'),
      icon: Shield,
      permissions: requireAnyPermission([
        PERMISSIONS.UI.NAVIGATION_AUTH
      ]),
    },
    {
      href: '/data',
      label: t('data'),
      icon: Database,
      permissions: requireAnyPermission([
        PERMISSIONS.UI.NAVIGATION_DATA
      ]),
    },
    {
      href: '/persona',
      label: t('persona'),
      icon: UserCircle,
      permissions: requireAnyPermission([
        PERMISSIONS.UI.NAVIGATION_PERSONA
      ]),
    },
    {
      href: '/knowledge',
      label: t('knowledge'),
      icon: BookOpen,
      permissions: requireAnyPermission([
        PERMISSIONS.UI.NAVIGATION_KNOWLEDGE
      ]),
    },
  ];

  // Filter nav items based on user permissions
  const authorizedNavItems = navItems.filter(item => checkMenuAccess(item.permissions));

  return (
    <header className="h-16 glass-dark px-6 flex items-center justify-between fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center glow-blue">
            <span className="text-white font-bold text-lg">IT</span>
          </div>
          <span className={`text-xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('title')}</span>
        </div>

        {/* Main Navigation - Only show authorized items */}
        <nav className="flex items-center gap-1">
          {authorizedNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 focus:outline-none ${isActive
                  ? 'nav-active text-blue-500'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-900/5 border border-transparent'
                    : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <ThemeSwitcher />
        <LanguageSwitcher />
        <button className={`p-2 rounded-full transition-all duration-300 ${isLight ? 'text-slate-500 hover:text-slate-800 hover:bg-slate-900/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}>
          <Bell className="w-5 h-5" />
        </button>

        {/* User Profile Dropdown */}
        <div className="relative group">
          <button className={`w-9 h-9 bg-gradient-to-br from-blue-500/30 to-purple-500/30 border rounded-full flex items-center justify-center font-medium text-sm hover:from-blue-500/50 hover:to-purple-500/50 transition-all duration-300 ${isLight ? 'border-slate-300 text-slate-700' : 'border-white/20 text-white'}`}>
            {initials}
          </button>

          {/* Dropdown Menu */}
          <div className="absolute right-0 top-full mt-2 w-64 glass-dark rounded-xl shadow-2xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top-right">
            <div className={`px-4 py-3 border-b ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
              <p className={`text-sm font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                {user?.full_name || '\u00A0'}
              </p>
              <p className={`text-sm truncate ${isLight ? 'text-slate-600' : 'text-gray-400'}`}>
                {user?.username || '\u00A0'}
              </p>
              <p className={`text-xs truncate mt-1 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                {user?.email || '\u00A0'}
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
    </header>
  );
}
