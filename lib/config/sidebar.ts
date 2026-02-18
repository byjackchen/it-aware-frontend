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
    ClipboardList,
    MessageCircle,
    MousePointerClick,
    BellRing,
    ClipboardCheck,
} from 'lucide-react';
import { PERMISSIONS } from './permissions';
import { requireAnyPermission, requireAllPermissions, type MenuItem } from '@/lib/types/menu';

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
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.ORGANIZATIONS_READ,
                        ]),
                    },
                    {
                        href: '/data/locations',
                        labelKey: 'locations',
                        icon: MapPin,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.LOCATIONS_READ,
                        ]),
                    },
                    {
                        href: '/data/service-catalogs',
                        labelKey: 'serviceCatalogs',
                        icon: Layers,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.SERVICE_CATALOGS_READ,
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
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.WORKERS_READ,
                        ]),
                    },
                    {
                        href: '/data/articles',
                        labelKey: 'articles',
                        icon: FileText,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.ARTICLES_READ,
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
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.INCIDENTS_READ,
                        ]),
                    },
                    {
                        href: '/data/requests',
                        labelKey: 'requests',
                        icon: ClipboardList,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.REQUESTS_READ,
                        ]),
                    },
                    {
                        href: '/data/inquiries',
                        labelKey: 'inquiries',
                        icon: MessageCircle,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.INQUIRIES_READ,
                        ]),
                    },
                    {
                        href: '/data/interactions',
                        labelKey: 'interactions',
                        icon: MousePointerClick,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.INTERACTIONS_READ,
                        ]),
                    },
                ],
            },
        ],
    },
    '/campaign': {
        sections: [
            {
                labelKey: 'campaign',
                items: [
                    {
                        href: '/campaign/notifications',
                        labelKey: 'notifications',
                        icon: BellRing,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_CAMPAIGN,
                            PERMISSIONS.OBJECTS.NOTIFICATIONS_READ,
                        ]),
                    },
                    {
                        href: '/campaign/surveys',
                        labelKey: 'surveys',
                        icon: ClipboardCheck,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_CAMPAIGN,
                            PERMISSIONS.OBJECTS.SURVEYS_READ,
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
