/**
 * Sidebar configuration for main navigation paths.
 * Determines which top-level routes have a sidebar with sub-menus.
 */

import {
    Shield,
    Lock,
    User,
    Users,
    FileText,
    Building2,
    MapPin,
    Layers,
    AlertCircle,
    MessageCircle,
} from 'lucide-react';
import { PERMISSIONS } from './permissions';
import { requireAnyPermission, type MenuItem } from '@/lib/types/menu';

/**
 * Section divider configuration for grouping menu items.
 */
export interface SectionConfig {
    labelKey: string;
    items: MenuItem[];
}

export type SubMenuWithSections = {
    sections?: SectionConfig[];
    items?: MenuItem[];
};

/**
 * Sub-menu items configuration for each main section.
 * Each item includes permission requirements for authorization.
 * Sections can optionally be used to group items with collapsible dividers.
 */
export const SIDEBAR_CONFIG: Record<string, SubMenuWithSections> = {
    '/auth': {
        items: [
            {
                href: '/auth/permissions',
                labelKey: 'permissions',
                icon: Lock,
                permissions: requireAnyPermission([
                    PERMISSIONS.UI.NAVIGATION_AUTH
                ]),
            },
            {
                href: '/auth/accounts',
                labelKey: 'accounts',
                icon: User,
                permissions: requireAnyPermission([
                    PERMISSIONS.UI.NAVIGATION_AUTH
                ]),
            },
            {
                href: '/auth/groups',
                labelKey: 'groups',
                icon: Users,
                permissions: requireAnyPermission([
                    PERMISSIONS.UI.NAVIGATION_AUTH
                ]),
            },
            {
                href: '/auth/roles',
                labelKey: 'roles',
                icon: Shield,
                permissions: requireAnyPermission([
                    PERMISSIONS.UI.NAVIGATION_AUTH
                ]),
            },
        ],
    },
    '/data': {
        sections: [
            {
                labelKey: 'hierarchies',
                items: [
                    {
                        href: '/data/organizations',
                        labelKey: 'organizations',
                        icon: Building2,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_DATA
                        ]),
                    },
                    {
                        href: '/data/locations',
                        labelKey: 'locations',
                        icon: MapPin,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_DATA
                        ]),
                    },
                    {
                        href: '/data/service-catalogs',
                        labelKey: 'serviceCatalogs',
                        icon: Layers,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_DATA
                        ]),
                    },
                ],
            },
            {
                labelKey: 'objects',
                items: [
                    {
                        href: '/data/workers',
                        labelKey: 'workers',
                        icon: Users,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_DATA
                        ]),
                    },
                    {
                        href: '/data/articles',
                        labelKey: 'articles',
                        icon: FileText,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_DATA
                        ]),
                    },
                ],
            },
            {
                labelKey: 'activities',
                items: [
                    {
                        href: '/data/incidents',
                        labelKey: 'incidents',
                        icon: AlertCircle,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_DATA
                        ]),
                    },
                    {
                        href: '/data/inquiries',
                        labelKey: 'inquiries',
                        icon: MessageCircle,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_DATA
                        ]),
                    },
                ],
            },
        ],
    },
    // Note: /persona is intentionally excluded - it uses the full page width for the profile view
    // Note: /knowledge is intentionally excluded - it uses its own CatalogSidebar
    // instead of the standard navigation sidebar
};

/**
 * Get all paths that have a sidebar.
 */
export function getSidebarPaths(): string[] {
    return Object.keys(SIDEBAR_CONFIG);
}

/**
 * Check if a pathname has a sidebar.
 */
export function hasPathSidebar(pathname: string): boolean {
    return getSidebarPaths().some(path => pathname.startsWith(path));
}
