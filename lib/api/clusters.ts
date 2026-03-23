/**
 * Server-side API client for Worker Clusters.
 */

import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { fetchApi } from '@/lib/api/core';
import type {
    WorkerCluster,
    WorkerClusterListParams,
    WorkerClusterListResponse,
    ClusterSummaryResponse,
} from '@/lib/types/objects';

const CLUSTERS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects/insights/worker-clusters`;

// ============================================================================
// Worker Cluster APIs
// ============================================================================

export async function getClusterSummary(): Promise<ClusterSummaryResponse> {
    return fetchApi<ClusterSummaryResponse>(`${CLUSTERS_BASE}/summary`, {
        next: { revalidate: 3600 },
    });
}

export async function getWorkerClustersPage(
    params: WorkerClusterListParams = {},
): Promise<WorkerClusterListResponse> {
    const queryParams = new URLSearchParams();
    if (params.skip !== undefined) queryParams.set('skip', String(params.skip));
    if (params.limit !== undefined) queryParams.set('limit', String(params.limit));
    if (params.cluster_label !== undefined) queryParams.set('cluster_label', String(params.cluster_label));
    if (params.run_id !== undefined) queryParams.set('run_id', params.run_id);

    const queryString = queryParams.toString();
    const url = `${CLUSTERS_BASE}${queryString ? `?${queryString}` : ''}`;
    return fetchApi<WorkerClusterListResponse>(url);
}

export async function getWorkerCluster(workerOid: string): Promise<WorkerCluster> {
    return fetchApi<WorkerCluster>(`${CLUSTERS_BASE}/${encodeURIComponent(workerOid)}`);
}
