'use client';

import { useState } from 'react';
import { NavLink } from '@/components/navigation/NavLink';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useMenuAuthorization } from './AuthorizedMenuItem';
import { SIDEBAR_CONFIG, type SubMenuWithSections } from '@/lib/config/sidebar';
import type { MenuItem } from '@/lib/types/menu';
import { SidebarSection } from './SidebarSection';

export function Sidebar() {
    const pathname = usePathname();
    const t = useTranslations('Sidebar');
    const { theme } = useTheme();
    const { checkMenuAccess } = useMenuAuthorization();
    const isLight = theme === 'light';

    // Determine which sub-menu to show based on current path
    const getActiveSubMenu = (): SubMenuWithSections | null => {
        for (const [path, config] of Object.entries(SIDEBAR_CONFIG)) {
            if (pathname.startsWith(path)) {
                return config;
            }
        }
        return null;
    };

    const activeConfig = getActiveSubMenu();

    // Don't render sidebar if no sub-menu for current path
    if (!activeConfig) return null;

    const renderMenuItems = (items: MenuItem[]) => {
        const authorizedItems = items.filter(item => checkMenuAccess(item.permissions));

        return authorizedItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
                (item.href !== '/' && pathname.startsWith(item.href));

            return (
                <NavLink
                    key={item.href}
                    href={item.href}
                    className={`
                        flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200
                        ${isActive
                            ? 'sidebar-active'
                            : isLight
                                ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                        }
                    `}
                >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span>{t(item.labelKey!)}</span>
                </NavLink>
            );
        });
    };

    return (
        <aside className={`fixed left-0 top-16 h-[calc(100vh-4rem)] w-56 glass-dark p-4 overflow-y-auto z-40 ${isLight ? 'border-r border-slate-200' : ''}`}>
            <nav className="space-y-2">
                {/* Render sections if defined */}
                {activeConfig.sections?.map((section, index) => (
                    <SidebarSection
                        key={section.labelKey}
                        labelKey={section.labelKey}
                        items={section.items}
                        pathname={pathname}
                        t={t}
                        isLight={isLight}
                        checkMenuAccess={checkMenuAccess}
                    />
                ))}

                {/* Render flat items if no sections */}
                {activeConfig.items && renderMenuItems(activeConfig.items)}
            </nav>
        </aside>
    );
}
