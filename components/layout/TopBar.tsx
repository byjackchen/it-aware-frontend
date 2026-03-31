'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';
import { BarChart3, Bell, BookOpen, Database, LayoutDashboard, LogOut, Shield, UserCircle, Layers, ChevronDown, Megaphone, Headset } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeSwitcher } from './ThemeSwitcher';
import { TimezoneSelect } from '@/components/data/TimezoneSelect';
import { GlobalSearch } from '@/components/search';
import { useTranslations } from 'next-intl';
import { logout } from '@/app/actions/session';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@/lib/contexts/user-context';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { useMenuAuthorization } from './AuthorizedMenuItem';
import { PERMISSIONS } from '@/lib/config/permissions';
import { type MenuItem, requireAnyPermission } from '@/lib/types/menu';

// Extended MenuItem with optional children for submenus
interface NavMenuItem extends MenuItem {
  children?: MenuItem[];
}

export function TopBar() {
  const t = useTranslations('TopBar');
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, clearUser } = useUser();
  const { theme } = useTheme();
  const { timezone, setTimezone } = useTimezone();
  const { checkMenuAccess } = useMenuAuthorization();
  const isLight = theme === 'light';
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Handle hover with delay to prevent flickering
  const handleMouseEnter = (menuHref: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setHoveredMenu(menuHref);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredMenu(null);
    }, 150);
  };

  // Navigation items with permission requirements
  // Application menu consolidates Knowledge and Persona
  const navItems: NavMenuItem[] = [
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
      href: '/application',
      label: t('application'),
      icon: Layers,
      permissions: requireAnyPermission([
        PERMISSIONS.UI.NAVIGATION_KNOWLEDGE,
        PERMISSIONS.UI.NAVIGATION_PERSONA,
        PERMISSIONS.UI.NAVIGATION_CAMPAIGN,
      ]),
      children: [
        {
          href: '/knowledge',
          label: t('knowledge'),
          icon: BookOpen,
          permissions: requireAnyPermission([
            PERMISSIONS.UI.NAVIGATION_KNOWLEDGE
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
          href: '/campaign',
          label: t('campaign'),
          icon: Megaphone,
          permissions: requireAnyPermission([
            PERMISSIONS.UI.NAVIGATION_CAMPAIGN
          ]),
        },
        {
          href: '/ssc-cockpit',
          label: t('sscCockpit'),
          icon: Headset,
          permissions: requireAnyPermission([
            PERMISSIONS.UI.NAVIGATION_DATA,
          ]),
        },
      ],
    },
    {
      href: '/dashboard/data-overview',
      label: t('dashboard'),
      icon: LayoutDashboard,
      permissions: requireAnyPermission([]),
    },
  ];

  // Filter nav items and their children based on user permissions
  const authorizedNavItems = navItems
    .filter(item => checkMenuAccess(item.permissions))
    .map(item => ({
      ...item,
      children: item.children?.filter(child => checkMenuAccess(child.permissions))
    }));

  // Check if any child route is active
  const isMenuActive = (item: NavMenuItem) => {
    if (item.children && item.children.length > 0) {
      return item.children.some(child => pathname.startsWith(child.href));
    }
    return pathname.startsWith(item.href);
  };

  return (
    <header
      className="glass-dark px-6 flex flex-col fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300 ease-in-out"
    >
      {/* Main Navigation Row */}
      <div className="h-16 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center glow-blue">
              <span className="text-white font-bold text-lg">IA</span>
            </div>
            <span className={`text-xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('title')}</span>
          </div>

          {/* Main Navigation - Only show authorized items */}
          <nav className="flex items-center gap-1">
            {authorizedNavItems.map((item) => {
              const isActive = isMenuActive(item);
              const Icon = item.icon;
              const hasChildren = item.children && item.children.length > 0;
              const isHovered = hoveredMenu === item.href;

              return (
                <div
                  key={item.href}
                  className="relative"
                  onMouseEnter={() => hasChildren && handleMouseEnter(item.href)}
                  onMouseLeave={handleMouseLeave}
                >
                  {hasChildren ? (
                    <button
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 focus:outline-none ${isActive || isHovered
                        ? 'nav-active text-blue-500'
                        : isLight
                          ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-900/5 border border-transparent'
                          : 'text-gray-300 hover:text-white hover:bg-white/5 border border-transparent'
                        }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="font-medium">{item.label}</span>
                      <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isHovered ? 'rotate-180' : ''}`} />
                    </button>
                  ) : (
                    <Link
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
                  )}

                  {/* Dropdown Menu - Positioned relatively to the item */}
                  {hasChildren && (
                    <div
                      className={`
                        absolute top-full left-0 mt-2 min-w-[200px] p-2 rounded-xl border shadow-xl
                        transform transition-all duration-200 origin-top-left
                        ${isHovered
                          ? 'opacity-100 visible translate-y-0'
                          : 'opacity-0 invisible -translate-y-2 pointer-events-none'
                        }
                        ${isLight
                          ? 'bg-white border-slate-200'
                          : 'bg-slate-900 border-white/10'
                        }
                      `}
                    >
                      {item.children?.map((child) => {
                        const ChildIcon = child.icon;
                        const isChildActive = pathname.startsWith(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`
                              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 mb-1 last:mb-0
                              ${isChildActive
                                ? 'bg-blue-500/10 text-blue-500'
                                : isLight
                                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                                  : 'text-gray-300 hover:text-white hover:bg-white/5'
                              }
                            `}
                          >
                            <ChildIcon className="w-4 h-4" />
                            <span className="text-sm font-medium">{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
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
            <button className={`w-9 h-9 bg-gradient-to-br from-blue-500/30 to-purple-500/30 border rounded-full flex items-center justify-center font-medium text-sm hover:from-blue-500/50 hover:to-purple-500/50 transition-all duration-300 ${isLight ? 'border-slate-300 text-slate-700' : 'border-white/20 text-white'}`}>
              {initials}
            </button>

            {/* Dropdown Menu */}
            <div className="absolute right-0 top-full mt-2 w-64 glass-dark rounded-xl shadow-2xl py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform origin-top-right">
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
