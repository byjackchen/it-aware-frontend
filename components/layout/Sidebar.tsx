'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    Shield,
    Lock,
    User,
    Users,
    Settings,
    FileText,
    HelpCircle
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useMenuAuthorization } from './AuthorizedMenuItem';
import { PERMISSIONS } from '@/lib/config/permissions';
import { type MenuItem, type SubMenuConfig, requireAnyPermission } from '@/lib/types/menu';

/**
 * Sub-menu items configuration for each main section.
 * Each item includes permission requirements for authorization.
 */
const subMenuItems: SubMenuConfig = {
    '/security': [
        {
            href: '/security/permissions',
            labelKey: 'permissions',
            icon: Lock,
            permissions: requireAnyPermission([
                PERMISSIONS.UI.NAVIGATION_SECURITY
            ]),
        },
        {
            href: '/security/accounts',
            labelKey: 'accounts',
            icon: User,
            permissions: requireAnyPermission([
                PERMISSIONS.UI.NAVIGATION_SECURITY
            ]),
        },
        {
            href: '/security/groups',
            labelKey: 'groups',
            icon: Users,
            permissions: requireAnyPermission([
                PERMISSIONS.UI.NAVIGATION_SECURITY
            ]),
        },
        {
            href: '/security/roles',
            labelKey: 'roles',
            icon: Shield,
            permissions: requireAnyPermission([
                PERMISSIONS.UI.NAVIGATION_SECURITY
            ]),
        },
    ],
    '/persona': [
        {
            href: '/persona/profile',
            labelKey: 'profile',
            icon: User,
            permissions: requireAnyPermission([
                PERMISSIONS.UI.NAVIGATION_PERSONA
            ]),
        },
        {
            href: '/persona/team',
            labelKey: 'team',
            icon: Users,
            permissions: requireAnyPermission([
                PERMISSIONS.UI.NAVIGATION_PERSONA
            ]),
        },
        {
            href: '/persona/settings',
            labelKey: 'settings',
            icon: Settings,
            permissions: requireAnyPermission([
                PERMISSIONS.UI.NAVIGATION_PERSONA
            ]),
        },
    ],
    '/knowledge': [
        {
            href: '/knowledge/articles',
            labelKey: 'articles',
            icon: FileText,
            permissions: requireAnyPermission([
                PERMISSIONS.UI.NAVIGATION_KNOWLEDGE
            ]),
        },
        {
            href: '/knowledge/faqs',
            labelKey: 'faqs',
            icon: HelpCircle,
            permissions: requireAnyPermission([
                PERMISSIONS.UI.NAVIGATION_KNOWLEDGE
            ]),
        },
    ],
};

export function Sidebar() {
    const t = useTranslations('Sidebar');
    const pathname = usePathname();
    const { theme } = useTheme();
    const { checkMenuAccess } = useMenuAuthorization();
    const isLight = theme === 'light';

    // Determine which main section is active
    const activeSection = Object.keys(subMenuItems).find(section =>
        pathname.startsWith(section)
    );

    // Get sub-menu items for active section and filter by permissions
    const currentSubMenu = activeSection
        ? subMenuItems[activeSection].filter(item => checkMenuAccess(item.permissions))
        : [];

    // Don't render sidebar if no active section with authorized sub-menu items
    if (!activeSection || currentSubMenu.length === 0) {
        return null;
    }

    return (
        <aside className="w-56 glass-dark border-r-0 fixed top-16 bottom-0 left-0 overflow-y-auto z-40">
            <nav className="p-3 space-y-1">
                {currentSubMenu.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 focus:outline-none ${isActive
                                    ? 'nav-active text-blue-500'
                                    : isLight
                                        ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-900/5 border border-transparent'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-blue-500' : isLight ? 'text-slate-500' : 'text-gray-500'}`} />
                            <span className="text-sm font-medium">{item.labelKey ? t(item.labelKey) : item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
