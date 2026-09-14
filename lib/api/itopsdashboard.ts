/**
 * Server-side API client for the ITOps Dashboard overview (海外IT运营看板).
 * Backend domain: /dashboards/itopsdashboard/...
 */

import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { fetchApi } from '@/lib/api/core';
import { assembleDashboard, type ApiDashboard, type DashboardData } from '@/lib/itopsdashboard/dashboard';

const BASE = `${RUNTIME_CONFIG.backend.domain}/dashboards/itopsdashboard`;

/**
 * The whole overview page in one request.
 *
 * The backend returns raw values; statuses are resolved here so the threshold
 * rules stay in a single language (see lib/itopsdashboard/dashboard.ts).
 */
export async function getItopsOverview(): Promise<DashboardData> {
    return assembleDashboard(await fetchApi<ApiDashboard>(`${BASE}/overview`));
}
