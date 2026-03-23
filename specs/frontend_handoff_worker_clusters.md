# Frontend Handoff: Worker Clusters (IT User Profiling)

## Summary

The backend now provides a **worker clustering pipeline** that groups ~2,200 active workers into behavioral clusters using HDBSCAN on 30 computed features. Results are stored in `insights.worker_clusters` and exposed via 4 API endpoints. The frontend persona page needs to integrate this data.

---

## What Exists Today

The persona page (`/persona/[oid]`) displays:
- Worker header (name, email, VIP, hire date)
- Job info (org, location, band)
- Profile (summary, topics, tags)
- Activities timeline (custom SVG)
- Graph links (edges)

**What's missing**: No cluster/segment information is shown. Workers are viewed individually with no group context.

---

## What the Backend Provides

### New API Endpoints

Base path: `/objects/insights/worker-clusters`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/summary` | Aggregate cluster summary (cluster names, sizes, profiles) |
| GET | `/` | Paginated list of all worker assignments |
| GET | `/{worker_oid}` | Single worker's cluster assignment |
| POST | `/bulk` | Bulk upsert (used by DAG only) |

### Data Available Per Worker

```typescript
interface WorkerCluster {
    worker_oid: string;           // base64url OID
    cluster_label: number;        // -1 = noise (outlier)
    cluster_probability: number;  // 0.0–1.0 membership confidence
    outlier_score: number;        // higher = more outlier-like
    cluster_name: string | null;  // LLM-generated name, e.g. "VIP高管型"
    cluster_profile: ClusterProfile | null;
    behavior_features: Record<string, number> | null;  // 28 behavioral features (drive clustering)
    label_features: Record<string, number> | null;     // {is_vip: 0/1, is_new_hire: 0/1} (overlay, not used in clustering)
    pca_3d: [number, number, number] | null;           // 3D coordinates (from behavior features only)
    behavior_scales: Record<string, {mean: number, scale: number}> | null;  // StandardScaler per behavior feature
    run_id: string;
    computed_at: string;          // ISO8601
}
```

**Computing Z-scores from `behavior_features` + `behavior_scales`:**
```typescript
// z_score = (raw_value - mean) / scale
const zScore = (behaviorFeatures[name] - behaviorScales[name].mean) / behaviorScales[name].scale;
```

**Label features** (`is_vip`, `is_new_hire`) are identity attributes excluded from clustering to prevent them from dominating the cluster structure. They are stored separately as overlay data for display (e.g. "this behavioral cluster contains 5 VIPs").

interface ClusterProfile {
    name: string;                 // e.g. "新人高频求助型"
    description: string;
    key_behaviors: string[];      // 3-5 bullets
    pain_points: string[];        // 2-3 bullets
    best_practices: string[];     // 3-5 recommendations
    sla_recommendation: string;
}
```

### Cluster Summary Response

```typescript
interface ClusterSummary {
    run_id: string | null;
    computed_at: string | null;
    total_workers: number;
    n_clusters: number;
    noise_count: number;
    clusters: ClusterInfo[];
}

interface ClusterInfo {
    cluster_label: number;
    cluster_name: string | null;
    size: number;
    percentage: number;          // e.g. 31.4
    cluster_profile: ClusterProfile | null;
}
```

### Current Cluster Data (as of March 2026)

| Cluster | Size | % | Signature |
|---------|------|---|-----------|
| -1 (noise) | 143 | 6.5% | Outliers |
| 0 | 32 | 1.4% | VIP executives — high tenure, is_vip +7.5σ |
| 1 | 83 | 3.8% | New hires — is_new_hire +4.9σ, low profile data |
| 2 | 1,953 | 88.3% | General population |

---

## Recommended Frontend Integration

### 1. Per-Worker Cluster Badge (on PersonaProfilePage)

**Where**: In the worker header section, next to VIP badge.

**API call**: `GET /objects/insights/worker-clusters/{worker_oid}`

**Display**:
- Cluster name badge (e.g. "VIP高管型") with color coding
- Membership probability as confidence indicator
- Noise workers (-1) shown as "未分类" in gray

### 2. Cluster Profile Card (on PersonaProfilePage)

**Where**: New section between "Profile Info" and "Activities Timeline".

**Display**:
- Cluster name + description
- Key behaviors (bullet list)
- Pain points (bullet list)
- Best practices / SLA recommendation
- "Based on {n} similar workers" context

### 3. Feature Radar Chart (on PersonaProfilePage)

**Where**: Inside the cluster profile card or as a tab.

**Data source**: `feature_vector` from the worker cluster response. Top 8-10 features by absolute Z-score deviation from the cluster fingerprint.

**Recharts** is already in `package.json` — use `<RadarChart>` component.

### 4. 3D Cluster Scatter Plot (new page or section)

**Where**: Either a new `/persona/clusters` page or a modal/drawer from the persona page.

**Data source**:
- `GET /objects/insights/worker-clusters?limit=1000` for all assignments
- Use `pca_3d` coordinates for positioning
- Color by `cluster_label`

**Visualization**: Three.js or a simpler 2D projection using the first 2 of 3 PCA components with Recharts `<ScatterChart>`. The 3rd dimension can be shown via point size or opacity.

### 5. Cluster Summary Dashboard (new page or widget)

**Where**: `/persona/clusters` or a dashboard widget.

**API call**: `GET /objects/insights/worker-clusters/summary`

**Display**:
- Cluster count, noise ratio, last computed date
- Per-cluster cards with size, percentage, name, profile summary
- Radar chart comparing cluster fingerprints side-by-side

---

## New TypeScript Types Needed

Add to `/lib/types/objects.ts`:

```typescript
// ============================================================================
// Worker Cluster Types
// ============================================================================

export interface ClusterProfile {
    name: string;
    description: string;
    key_behaviors: string[];
    pain_points: string[];
    best_practices: string[];
    sla_recommendation: string;
}

export interface WorkerCluster {
    worker_oid: string;
    cluster_label: number;
    cluster_probability: number;
    outlier_score: number;
    cluster_name: string | null;
    cluster_profile: ClusterProfile | null;
    behavior_features: Record<string, number> | null;
    label_features: Record<string, number> | null;
    pca_3d: [number, number, number] | null;
    behavior_scales: Record<string, {mean: number; scale: number}> | null;
    run_id: string;
    computed_at: string;
}

export interface WorkerClusterListResponse {
    items: WorkerCluster[];
    total: number;
    skip: number;
    limit: number;
}

export interface ClusterInfo {
    cluster_label: number;
    cluster_name: string | null;
    size: number;
    percentage: number;
    cluster_profile: ClusterProfile | null;
}

export interface ClusterSummaryResponse {
    run_id: string | null;
    computed_at: string | null;
    total_workers: number;
    n_clusters: number;
    noise_count: number;
    clusters: ClusterInfo[];
}
```

## New API Client Functions Needed

Add to `/lib/api/objects.ts`:

```typescript
// Worker Clusters
export async function getWorkerCluster(workerOid: string): Promise<WorkerCluster | null> {
    return fetchApi(`/objects/insights/worker-clusters/${workerOid}`, { next: { revalidate: 3600 } });
}

export async function getWorkerClusters(params?: {
    skip?: number;
    limit?: number;
    cluster_label?: number;
}): Promise<WorkerClusterListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.skip) searchParams.set('skip', String(params.skip));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.cluster_label !== undefined) searchParams.set('cluster_label', String(params.cluster_label));
    return fetchApi(`/objects/insights/worker-clusters?${searchParams}`);
}

export async function getClusterSummary(): Promise<ClusterSummaryResponse> {
    return fetchApi('/objects/insights/worker-clusters/summary', { next: { revalidate: 3600 } });
}
```

---

## 30 Feature Names Reference

These are the keys in `feature_vector`. Use them for radar chart axis labels and tooltips.

| Key | Display Name (EN) | Display Name (CN) |
|-----|-------------------|-------------------|
| `tenure_months` | Tenure (months) | 司龄（月） |
| `is_new_hire` | New Hire | 新员工 |
| `is_vip` | VIP | VIP |
| `location_region` | Region | 地区 |
| `org_depth` | Org Depth | 组织层级 |
| `incident_count` | Incident Count | 工单数 |
| `incident_monthly_rate` | Incidents/Month | 月均工单 |
| `incident_avg_resolution_hours` | Avg Resolution (hrs) | 平均解决时长 |
| `incident_high_priority_ratio` | High Priority % | 高优先级占比 |
| `incident_self_service_ratio` | Self-Service % | 自助渠道占比 |
| `incident_avg_chat_rounds` | Chat Rounds | 对话轮数 |
| `request_count` | Request Count | 申请数 |
| `request_monthly_rate` | Requests/Month | 月均申请 |
| `request_self_service_ratio` | Request Self-Service % | 申请自助占比 |
| `inquiry_count` | Inquiry Count | 咨询数 |
| `inquiry_monthly_rate` | Inquiries/Month | 月均咨询 |
| `inquiry_resolved_ratio` | Bot Resolved % | 机器人解决率 |
| `inquiry_avg_message_rounds` | Msg Rounds | 对话轮数 |
| `inquiry_unresolved_ratio` | Escalation % | 转人工率 |
| `interaction_count` | Interaction Count | 互动数 |
| `interaction_query_ratio` | Query % | 文字查询占比 |
| `interaction_click_ratio` | Click % | 点击占比 |
| `catalog_ratio_0` | Auth Error % | 认证错误占比 |
| `catalog_ratio_1` | Account Mgmt % | 账号管理占比 |
| `catalog_ratio_2` | Software % | 软件问题占比 |
| `catalog_ratio_3` | Access Request % | 权限申请占比 |
| `catalog_ratio_4` | App Outage % | 应用故障占比 |
| `profile_topic_count` | Profile Topics | 画像主题数 |
| `profile_tag_count` | Profile Tags | 画像标签数 |
| `off_hours_ratio` | Off-Hours % | 非工时占比 |

---

## i18n Keys Suggested

```
Persona.cluster.label: "User Cluster" / "用户群组"
Persona.cluster.noise: "Uncategorized" / "未分类"
Persona.cluster.probability: "Confidence" / "置信度"
Persona.cluster.profile: "Cluster Profile" / "群组画像"
Persona.cluster.behaviors: "Key Behaviors" / "核心行为"
Persona.cluster.painPoints: "Pain Points" / "痛点"
Persona.cluster.bestPractices: "Best Practices" / "最佳实践"
Persona.cluster.sla: "SLA Recommendation" / "SLA建议"
Persona.cluster.summary: "Cluster Overview" / "群组概览"
Persona.cluster.features: "Feature Profile" / "特征画像"
```

---

## Implementation Priority

1. **P0**: Add `WorkerCluster` type + API client functions (foundation)
2. **P1**: Cluster badge on worker header (quick win, high visibility)
3. **P1**: Cluster profile card on persona page (main content)
4. **P2**: Feature radar chart (requires Recharts integration)
5. **P3**: 3D scatter plot / cluster summary dashboard (larger feature)
