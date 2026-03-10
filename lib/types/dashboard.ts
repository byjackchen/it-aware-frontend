export type DashboardResourceKey =
    | 'organizations'
    | 'locations'
    | 'service-catalogs'
    | 'workers'
    | 'articles'
    | 'incidents'
    | 'requests'
    | 'inquiries'
    | 'interactions'
    | 'surveys'
    | 'notifications'
    | 'analyses';

export type DashboardResourceGroup = 'hierarchies' | 'objects' | 'activities' | 'campaigns' | 'insights';

export type DashboardResourceStatus = 'ok' | 'forbidden' | 'error';

export interface DashboardResourceStats {
    key: DashboardResourceKey;
    href: string;
    group: DashboardResourceGroup;
    total: number | null;
    active: number | null;
    inactive: number | null;
    status: DashboardResourceStatus;
}

export interface DashboardStatsSummary {
    total_across_resources: number;
    active_capable_total: number;
    active_capable_active: number;
    active_capable_inactive: number;
    available_resources: number;
}

export interface DashboardStatsResponse {
    generated_at: string;
    resources: DashboardResourceStats[];
    summary: DashboardStatsSummary;
}
