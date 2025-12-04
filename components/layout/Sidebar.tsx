'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { 
    ShieldCheck, 
    ShieldAlert, 
    KeyRound,
    User,
    Users,
    Settings
} from 'lucide-react';

// Define sub-menu items for each main section
const subMenuItems: Record<string, { href: string; labelKey: string; icon: React.ElementType }[]> = {
    '/security': [
        { href: '/security/overview', labelKey: 'overview', icon: ShieldCheck },
        { href: '/security/threats', labelKey: 'threats', icon: ShieldAlert },
        { href: '/security/access', labelKey: 'access', icon: KeyRound },
    ],
    '/persona': [
        { href: '/persona/profile', labelKey: 'profile', icon: User },
        { href: '/persona/team', labelKey: 'team', icon: Users },
        { href: '/persona/settings', labelKey: 'settings', icon: Settings },
    ],
};

export function Sidebar() {
    const t = useTranslations('Sidebar');
    const pathname = usePathname();

    // Determine which main section is active
    const activeSection = Object.keys(subMenuItems).find(section => 
        pathname.startsWith(section)
    );

    // Get sub-menu items for active section
    const currentSubMenu = activeSection ? subMenuItems[activeSection] : [];

    // Don't render sidebar if no active section with sub-menu
    if (!activeSection || currentSubMenu.length === 0) {
        return null;
    }

    return (
        <aside className="w-56 border-r border-gray-200 bg-gray-50 fixed top-16 bottom-0 left-0 overflow-y-auto z-40">
            <nav className="p-3 space-y-1">
                {currentSubMenu.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                                isActive
                                    ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                                    : 'text-gray-600 hover:bg-white hover:text-gray-900'
                            }`}
                        >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                            <span className="text-sm font-medium">{t(item.labelKey)}</span>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
