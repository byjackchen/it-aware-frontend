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
    HardDrive,
    Building2,
    MapPin,
    Layers,
    AlertCircle,
    ClipboardList,
    Link2,
    MousePointerClick,
    Bell,
    BellRing,
    ClipboardCheck,
    FileSearch,
    Sparkles,
    Network,
    Route,
    LayoutDashboard,
    BarChart3,
    BarChart2,
    Bot,
    Cpu,
    TicketCheck,
    KanbanSquare,
    List,
    Crown,
    Gauge,
    Timer,
    PackageCheck,
    PackageOpen,
    Wrench,
    DollarSign,
    Bot as Chatbot,
    LineChart,
    MessageSquare,
    HelpCircle,
    Headphones,
    ClipboardSignature,
    Search,
    Database,
    UserPlus,
    UserX,
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
                        href: '/data/agents',
                        labelKey: 'agents',
                        icon: Bot,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.AGENTS_READ,
                        ]),
                    },
                    {
                        href: '/data/systems',
                        labelKey: 'systems',
                        icon: Cpu,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.SYSTEMS_READ,
                        ]),
                    },
                    {
                        href: '/data/hardwares',
                        labelKey: 'hardwares',
                        icon: HardDrive,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.HARDWARES_READ,
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
                labelKey: 'networks',
                items: [
                    {
                        href: '/data/networks/ioa-scans',
                        labelKey: 'ioaScans',
                        icon: Network,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.NETWORKS.IOA_SCANS_READ,
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
            {
                labelKey: 'journeys',
                items: [
                    {
                        href: '/data/scenarios',
                        labelKey: 'scenarios',
                        icon: Route,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.SCENARIOS_READ,
                        ]),
                    },
                ],
            },
            {
                labelKey: 'campaign',
                items: [
                    {
                        href: '/data/notifications',
                        labelKey: 'notifications',
                        icon: Bell,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.NOTIFICATION_BATCHS_READ,
                        ]),
                    },
                    {
                        href: '/data/surveys',
                        labelKey: 'surveys',
                        icon: FileSearch,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.SURVEY_BATCHS_READ,
                        ]),
                    },
                ],
            },
            {
                labelKey: 'insights',
                items: [
                    {
                        href: '/data/analyses',
                        labelKey: 'analyses',
                        icon: Sparkles,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.ANALYSISS_READ,
                        ]),
                    },
                    {
                        href: '/data/clusters',
                        labelKey: 'clusters',
                        icon: Network,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.WORKER_CLUSTERS_READ,
                        ]),
                    },
                ],
            },
            {
                labelKey: 'agentOps',
                items: [
                    {
                        href: '/data/agentops/tickets',
                        labelKey: 'tickets',
                        icon: TicketCheck,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_DATA,
                            PERMISSIONS.OBJECTS.TICKETS_READ,
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
                        href: '/campaign/notification-batches',
                        labelKey: 'notificationBatches',
                        icon: BellRing,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_CAMPAIGN,
                            PERMISSIONS.OBJECTS.NOTIFICATION_BATCHS_READ,
                        ]),
                    },
                    {
                        href: '/campaign/survey-batches',
                        labelKey: 'surveyBatches',
                        icon: ClipboardCheck,
                        permissions: requireAllPermissions([
                            PERMISSIONS.UI.NAVIGATION_CAMPAIGN,
                            PERMISSIONS.OBJECTS.SURVEY_BATCHS_READ,
                        ]),
                    },
                ],
            },
            {
                labelKey: 'analytics',
                items: [
                    {
                        href: '/campaign/survey-analytics',
                        labelKey: 'surveyAnalytics',
                        icon: BarChart3,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_CAMPAIGN,
                        ]),
                    },
                ],
            },
        ],
    },
    '/dashboard': {
        items: [
            {
                href: '/dashboard/data-overview',
                labelKey: 'dataOverview',
                icon: BarChart3,
                permissions: requireAnyPermission([
                    PERMISSIONS.UI.NAVIGATION_DATA,
                ]),
            },
        ],
    },
    '/ssc-cockpit': {
        items: [
            {
                href: '/ssc-cockpit/dashboard',
                labelKey: 'sscDashboard',
                icon: LayoutDashboard,
                permissions: requireAllPermissions([
                    PERMISSIONS.UI.NAVIGATION_SSC,
                    PERMISSIONS.OBJECTS.INTERACTIONS_READ,
                    PERMISSIONS.OBJECTS.INCIDENTS_READ,
                ]),
            },
            {
                href: '/ssc-cockpit/faq-report',
                labelKey: 'faqReport',
                icon: BarChart2,
                permissions: requireAllPermissions([
                    PERMISSIONS.UI.NAVIGATION_SSC,
                    PERMISSIONS.OBJECTS.INTERACTIONS_READ,
                ]),
            },
            {
                href: '/ssc-cockpit/incident-report',
                labelKey: 'incidentReport',
                icon: AlertCircle,
                permissions: requireAllPermissions([
                    PERMISSIONS.UI.NAVIGATION_SSC,
                    PERMISSIONS.OBJECTS.INCIDENTS_READ,
                ]),
            },
            {
                href: '/ssc-cockpit/survey-lookup',
                labelKey: 'surveyLookup',
                icon: Link2,
                permissions: requireAllPermissions([
                    PERMISSIONS.UI.NAVIGATION_SSC,
                    PERMISSIONS.OBJECTS.INCIDENTS_READ,
                ]),
            },
        ],
    },
    '/operation-teams': {
        sections: [
            {
                labelKey: 'opsMonitoring',
                items: [
                    {
                        href: '/operation-teams/ops-dashboard',
                        labelKey: 'opsActiveMonitoring',
                        icon: Gauge,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/incidents',
                        labelKey: 'opsIncidents',
                        icon: AlertCircle,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/catalog',
                        labelKey: 'opsCatalog',
                        icon: ClipboardList,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/vip-tickets',
                        labelKey: 'opsVipTickets',
                        icon: Crown,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/unassigned',
                        labelKey: 'opsUnassigned',
                        icon: UserX,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/on-off-boarding',
                        labelKey: 'opsOnOffBoarding',
                        icon: UserPlus,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                ],
            },
            {
                labelKey: 'opsAging',
                items: [
                    {
                        href: '/operation-teams/ops-dashboard/aging-incidents',
                        labelKey: 'opsAgingIncidents',
                        icon: Timer,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/aging-sc-tasks',
                        labelKey: 'opsAgingScTasks',
                        icon: Timer,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/aging-asset-tasks',
                        labelKey: 'opsAgingAssetTasks',
                        icon: Timer,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                ],
            },
            {
                labelKey: 'opsAssets',
                items: [
                    {
                        href: '/operation-teams/ops-dashboard/assets',
                        labelKey: 'opsAssetsOverview',
                        icon: HardDrive,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/in-stock-assets',
                        labelKey: 'opsInStockAssets',
                        icon: PackageCheck,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/pending-assets',
                        labelKey: 'opsPendingAssets',
                        icon: PackageOpen,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/zero-residual-assets',
                        labelKey: 'opsZeroResidualAssets',
                        icon: DollarSign,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                ],
            },
            {
                labelKey: 'opsOhla',
                items: [
                    {
                        href: '/operation-teams/ops-dashboard/ohla/overview',
                        labelKey: 'opsOhlaOverview',
                        icon: LineChart,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/ohla/user-ask-analysis',
                        labelKey: 'opsOhlaUserAsk',
                        icon: HelpCircle,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/ohla/agent-support',
                        labelKey: 'opsOhlaAgentSupport',
                        icon: Headphones,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/ohla/survey-details',
                        labelKey: 'opsOhlaSurveyDetails',
                        icon: ClipboardSignature,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/ohla/other-case',
                        labelKey: 'opsOhlaOtherCase',
                        icon: Search,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                    {
                        href: '/operation-teams/ops-dashboard/ohla/raw-data',
                        labelKey: 'opsOhlaRawData',
                        icon: Database,
                        permissions: requireAnyPermission([
                            PERMISSIONS.UI.NAVIGATION_OPERATION,
                        ]),
                    },
                ],
            },
        ],
    },
    '/agent-ops': {
        items: [
            {
                href: '/agent-ops/agents',
                labelKey: 'agentFleet',
                icon: Bot,
                permissions: requireAllPermissions([
                    PERMISSIONS.UI.NAVIGATION_AGENT_OPS,
                    PERMISSIONS.OBJECTS.AGENTS_READ,
                ]),
            },
            {
                href: '/agent-ops/ticket-list',
                labelKey: 'ticketList',
                icon: List,
                permissions: requireAllPermissions([
                    PERMISSIONS.UI.NAVIGATION_AGENT_OPS,
                    PERMISSIONS.OBJECTS.TICKETS_READ,
                ]),
            },
            {
                href: '/agent-ops/ticket-kanban',
                labelKey: 'ticketKanban',
                icon: KanbanSquare,
                permissions: requireAllPermissions([
                    PERMISSIONS.UI.NAVIGATION_AGENT_OPS,
                    PERMISSIONS.OBJECTS.TICKETS_READ,
                ]),
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
