# Hardware Standalone Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken WorkerHardware sub-resource with a standalone Hardware section — new types, API client, route proxy, sidebar entry, list page, detail page, i18n, and worker detail cleanup.

**Architecture:** Clean sweep migration. Update `lib/types/objects.ts` and `lib/api/objects.ts` to replace old WorkerHardware types/functions with standalone Hardware equivalents. Add `hardwares` to the route proxy. Create new `/data/hardwares` list page (infinite scroll, 3 filter dropdowns) and `/data/hardwares/[oid]` detail page (8 clustered cards). Remove hardware section from worker detail. Follow existing Workers page patterns exactly.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, next-intl, lucide-react

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `lib/types/objects.ts` | Replace WorkerHardware types with Hardware types |
| Modify | `lib/api/objects.ts` | Replace worker hardware API functions with standalone hardware functions |
| Modify | `app/api/objects/[resource]/route.ts` | Add `hardwares` to RESOURCE_PATHS |
| Modify | `lib/config/permissions.ts` | Add HARDWARES_READ permission constant |
| Modify | `lib/config/sidebar.ts` | Add Hardwares menu item under Objects |
| Modify | `messages/en.json` | Add hardware list/detail i18n strings, update Sidebar |
| Modify | `messages/zh.json` | Add hardware list/detail i18n strings, update Sidebar |
| Create | `app/(main)/data/hardwares/page.tsx` | Server component wrapper for list page |
| Create | `app/(main)/data/hardwares/HardwaresListPage.tsx` | Client component for hardware list |
| Create | `app/(main)/data/hardwares/[oid]/page.tsx` | Server component for detail page |
| Create | `app/(main)/data/hardwares/[oid]/HardwareDetailPage.tsx` | Client component for detail display |
| Modify | `app/(main)/data/workers/[oid]/page.tsx` | Remove getWorkerHardwares call and hardwares prop |
| Modify | `app/(main)/data/workers/[oid]/WorkerDetailPage.tsx` | Remove hardware section, imports, props |

---

### Task 1: Update Types (`lib/types/objects.ts`)

**Files:**
- Modify: `lib/types/objects.ts:203-238`

- [ ] **Step 1: Replace WorkerHardware, WorkerHardwareCreate, WorkerHardwareUpdate with new types**

Replace lines 203–238 (the three `WorkerHardware*` interfaces) with:

```typescript
// ============================================================================
// Hardware Types (standalone — synced from ERP BPMS)
// ============================================================================

export interface Hardware {
    oid: string;
    serial_number: string;
    worker_oid: string | null;

    // Identity
    asset_tag: string | null;
    asset_number: string | null;

    // Model
    model_category: string | null;
    model_display_name: string | null;
    model_name: string | null;
    main_category: string | null;
    asset_function: string | null;
    asset_owner: string | null;

    // Assignment
    assigned_to_username: string | null;
    assigned_to_display_name: string | null;
    employment_type: string | null;
    employment_start_date: string | null;
    assigned_date: string | null;
    first_assigned_date: string | null;

    // Location / Org
    company: string | null;
    business_group: string | null;
    department: string | null;
    location: string | null;
    office_id: string | null;
    region_code: string | null;
    region: string | null;
    office_region: string | null;
    stock_room: string | null;

    // Cost (Decimal as string)
    cost: string | null;
    cost_center: string | null;
    procured_cost_center: string | null;
    residual_value: string | null;
    residual_date: string | null;
    budget_by_oit: boolean | null;
    cost_by_oit: boolean | null;

    // Status
    asset_status: string | null;
    substatus: string | null;
    retired_date: string | null;
    scheduled_retirement: string | null;

    // Verification
    verification_status: string | null;
    verified_date: string | null;
    verified_by: string | null;

    // Provenance
    erp_created_by: string | null;
    erp_created_date: string | null;
    erp_updated_date: string | null;
    owned_by: string | null;

    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface HardwareCreate {
    serial_number: string;
    worker_oid?: string | null;
    asset_tag?: string | null;
    asset_number?: string | null;
    model_category?: string | null;
    model_display_name?: string | null;
    model_name?: string | null;
    main_category?: string | null;
    asset_function?: string | null;
    asset_owner?: string | null;
    assigned_to_username?: string | null;
    assigned_to_display_name?: string | null;
    employment_type?: string | null;
    employment_start_date?: string | null;
    assigned_date?: string | null;
    first_assigned_date?: string | null;
    company?: string | null;
    business_group?: string | null;
    department?: string | null;
    location?: string | null;
    office_id?: string | null;
    region_code?: string | null;
    region?: string | null;
    office_region?: string | null;
    stock_room?: string | null;
    cost?: string | null;
    cost_center?: string | null;
    procured_cost_center?: string | null;
    residual_value?: string | null;
    residual_date?: string | null;
    budget_by_oit?: boolean | null;
    cost_by_oit?: boolean | null;
    asset_status?: string | null;
    substatus?: string | null;
    retired_date?: string | null;
    scheduled_retirement?: string | null;
    verification_status?: string | null;
    verified_date?: string | null;
    verified_by?: string | null;
    erp_created_by?: string | null;
    erp_created_date?: string | null;
    erp_updated_date?: string | null;
    owned_by?: string | null;
    is_active?: boolean;
}

export interface HardwareUpdate {
    worker_oid?: string | null;
    asset_tag?: string | null;
    asset_number?: string | null;
    model_category?: string | null;
    model_display_name?: string | null;
    model_name?: string | null;
    main_category?: string | null;
    asset_function?: string | null;
    asset_owner?: string | null;
    assigned_to_username?: string | null;
    assigned_to_display_name?: string | null;
    employment_type?: string | null;
    employment_start_date?: string | null;
    assigned_date?: string | null;
    first_assigned_date?: string | null;
    company?: string | null;
    business_group?: string | null;
    department?: string | null;
    location?: string | null;
    office_id?: string | null;
    region_code?: string | null;
    region?: string | null;
    office_region?: string | null;
    stock_room?: string | null;
    cost?: string | null;
    cost_center?: string | null;
    procured_cost_center?: string | null;
    residual_value?: string | null;
    residual_date?: string | null;
    budget_by_oit?: boolean | null;
    cost_by_oit?: boolean | null;
    asset_status?: string | null;
    substatus?: string | null;
    retired_date?: string | null;
    scheduled_retirement?: string | null;
    verification_status?: string | null;
    verified_date?: string | null;
    verified_by?: string | null;
    erp_created_by?: string | null;
    erp_created_date?: string | null;
    erp_updated_date?: string | null;
    owned_by?: string | null;
    is_active?: boolean;
}

export interface HardwareListResponse {
    items: Hardware[];
    total: number;
    skip: number;
    limit: number;
}

export interface HardwareListParams {
    skip?: number;
    limit?: number;
    worker_oid?: string;
    assigned_to_username?: string;
    serial_number?: string;
    asset_tag?: string;
    model_category?: string;
    main_category?: string;
    asset_status?: string;
    office_id?: string;
    region?: string;
    is_active?: boolean;
    unassigned?: boolean;
}
```

- [ ] **Step 2: Verify no TypeScript errors in the types file**

Run: `npx tsc --noEmit lib/types/objects.ts 2>&1 | head -20`
Expected: No errors related to the Hardware types (there may be unrelated errors from imports)

- [ ] **Step 3: Commit**

```bash
git add lib/types/objects.ts
git commit -m "feat(hardware): replace WorkerHardware types with standalone Hardware types"
```

---

### Task 2: Update API Client (`lib/api/objects.ts`)

**Files:**
- Modify: `lib/api/objects.ts:8-51` (import block)
- Modify: `lib/api/objects.ts:369-401` (worker hardware functions)

- [ ] **Step 1: Update the import block**

In the import block (lines 8–51), replace these three type imports:

```typescript
    WorkerHardware,
    WorkerHardwareCreate,
    WorkerHardwareUpdate,
```

with:

```typescript
    Hardware,
    HardwareCreate,
    HardwareUpdate,
    HardwareListResponse,
    HardwareListParams,
```

- [ ] **Step 2: Replace the 4 old worker hardware functions with 5 new standalone functions**

Replace lines 369–401 (the `// Worker Hardware APIs` section header through `deleteWorkerHardware`) with:

```typescript
// ============================================================================
// Hardware APIs (standalone)
// ============================================================================

export async function listHardwares(params: HardwareListParams = {}): Promise<HardwareListResponse> {
    const query = new URLSearchParams();
    if (params.skip !== undefined) query.set('skip', String(params.skip));
    if (params.limit !== undefined) query.set('limit', String(params.limit));
    if (params.worker_oid) query.set('worker_oid', params.worker_oid);
    if (params.assigned_to_username) query.set('assigned_to_username', params.assigned_to_username);
    if (params.serial_number) query.set('serial_number', params.serial_number);
    if (params.asset_tag) query.set('asset_tag', params.asset_tag);
    if (params.model_category) query.set('model_category', params.model_category);
    if (params.main_category) query.set('main_category', params.main_category);
    if (params.asset_status) query.set('asset_status', params.asset_status);
    if (params.office_id) query.set('office_id', params.office_id);
    if (params.region) query.set('region', params.region);
    if (params.is_active !== undefined) query.set('is_active', String(params.is_active));
    if (params.unassigned !== undefined) query.set('unassigned', String(params.unassigned));
    return fetchApi<HardwareListResponse>(`${OBJECTS_BASE}/hardwares?${query.toString()}`);
}

export async function getHardware(hardwareOid: string): Promise<Hardware> {
    return fetchApi<Hardware>(`${OBJECTS_BASE}/hardwares/detail?hardware_oid=${encodeURIComponent(hardwareOid)}`);
}

export async function createHardware(data: HardwareCreate): Promise<Hardware> {
    return fetchApi<Hardware>(`${OBJECTS_BASE}/hardwares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function updateHardware(hardwareOid: string, data: HardwareUpdate): Promise<Hardware> {
    return fetchApi<Hardware>(`${OBJECTS_BASE}/hardwares/detail?hardware_oid=${encodeURIComponent(hardwareOid)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
}

export async function deleteHardware(hardwareOid: string): Promise<void> {
    return fetchApi<void>(`${OBJECTS_BASE}/hardwares/detail?hardware_oid=${encodeURIComponent(hardwareOid)}`, {
        method: 'DELETE',
    });
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/api/objects.ts
git commit -m "feat(hardware): replace worker hardware API functions with standalone hardware endpoints"
```

---

### Task 3: Add Route Proxy (`app/api/objects/[resource]/route.ts`)

**Files:**
- Modify: `app/api/objects/[resource]/route.ts:5-19`

- [ ] **Step 1: Add hardwares to RESOURCE_PATHS**

In the `RESOURCE_PATHS` object (line 5–19), add after the `workers` entry:

```typescript
    hardwares: '/objects/hardwares',
```

So the object becomes:

```typescript
const RESOURCE_PATHS = {
    organizations: '/objects/organizations',
    locations: '/objects/locations',
    workers: '/objects/workers',
    hardwares: '/objects/hardwares',
    'service-catalogs': '/objects/service-catalogs',
    articles: '/objects/articles',
    incidents: '/objects/activities/incidents',
    requests: '/objects/activities/requests',
    inquiries: '/objects/activities/inquiries',
    interactions: '/objects/activities/interactions',
    analysiss: '/objects/insights/analysiss',
    'worker-clusters': '/objects/insights/worker-clusters',
    scenarios: '/objects/journeys/scenarios',
    roles: '/auth/config/roles',
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add app/api/objects/[resource]/route.ts
git commit -m "feat(hardware): add hardwares to resource proxy route"
```

---

### Task 4: Add Permission Constant and Sidebar Entry

**Files:**
- Modify: `lib/config/permissions.ts:20-53`
- Modify: `lib/config/sidebar.ts:1-28` (imports), `lib/config/sidebar.ts:121-143` (objects section)

- [ ] **Step 1: Add HARDWARES_READ to permissions.ts**

In `lib/config/permissions.ts`, inside the `OBJECTS` block, after `WORKERS_EDIT_SENSITIVE` (line 30), add:

```typescript
    HARDWARES_READ: 'objects:hardwares:read',
```

- [ ] **Step 2: Add HardDrive import to sidebar.ts**

In `lib/config/sidebar.ts`, add `HardDrive` to the lucide-react import (line 6–28). Add it after `FileText`:

```typescript
import {
    Shield,
    Lock,
    User,
    Users,
    FileText,
    HardDrive,
    Building2,
    ...
```

- [ ] **Step 3: Add Hardwares menu item under Objects section**

In `lib/config/sidebar.ts`, in the `objects` section (lines 122–142), add the Hardwares item after Workers and before Articles:

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add lib/config/permissions.ts lib/config/sidebar.ts
git commit -m "feat(hardware): add sidebar entry and permission constant"
```

---

### Task 5: Update i18n Strings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/zh.json`

- [ ] **Step 1: Add Sidebar label in en.json**

In `messages/en.json`, in the `"Sidebar"` block (around line 970), add after `"articles": "Articles"`:

```json
"hardwares": "Hardwares",
```

- [ ] **Step 2: Replace workers.hardware block and add Data.hardwares block in en.json**

In `messages/en.json`, replace the existing `"hardware"` block inside `"workers"` (lines 681–692) with a minimal reference:

```json
"hardware": {
    "title": "Hardware Assets",
    "empty": "No hardware assigned"
}
```

Then, inside the `"Data"` object, add a new top-level `"hardwares"` block (as a sibling of `"workers"`, `"articles"`, etc.):

```json
"hardwares": {
    "title": "Hardwares",
    "subtitle": "{active} Active / {total} Total",
    "searchPlaceholder": "Search by serial number, asset tag, or assignee...",
    "filterModelCategory": "Model Category",
    "filterAssetStatus": "Asset Status",
    "filterRegion": "Region",
    "filterAll": "All",
    "showInactive": "Show inactive",
    "empty": "No hardware assets found",
    "unassigned": "Unassigned",
    "detail": {
        "backToList": "Back to Hardwares",
        "identity": "Identity",
        "model": "Model",
        "assignment": "Assignment",
        "locationOrg": "Location / Org",
        "cost": "Cost",
        "status": "Status",
        "verification": "Verification",
        "provenance": "Provenance",
        "serialNumber": "Serial Number",
        "assetTag": "Asset Tag",
        "assetNumber": "Asset Number",
        "modelCategory": "Model Category",
        "modelDisplayName": "Model Display Name",
        "modelName": "Model Name",
        "mainCategory": "Main Category",
        "assetFunction": "Asset Function",
        "assetOwner": "Asset Owner",
        "assignedToUsername": "Assigned To (Username)",
        "assignedToDisplayName": "Assigned To",
        "employmentType": "Employment Type",
        "employmentStartDate": "Employment Start Date",
        "assignedDate": "Assigned Date",
        "firstAssignedDate": "First Assigned Date",
        "workerOid": "Worker",
        "company": "Company",
        "businessGroup": "Business Group",
        "department": "Department",
        "location": "Location",
        "officeId": "Office ID",
        "regionCode": "Region Code",
        "region": "Region",
        "officeRegion": "Office Region",
        "stockRoom": "Stock Room",
        "costValue": "Cost",
        "costCenter": "Cost Center",
        "procuredCostCenter": "Procured Cost Center",
        "residualValue": "Residual Value",
        "residualDate": "Residual Date",
        "budgetByOit": "Budget by OIT",
        "costByOit": "Cost by OIT",
        "assetStatus": "Asset Status",
        "substatus": "Substatus",
        "retiredDate": "Retired Date",
        "scheduledRetirement": "Scheduled Retirement",
        "verificationStatus": "Verification Status",
        "verifiedDate": "Verified Date",
        "verifiedBy": "Verified By",
        "erpCreatedBy": "ERP Created By",
        "erpCreatedDate": "ERP Created Date",
        "erpUpdatedDate": "ERP Updated Date",
        "ownedBy": "Owned By",
        "active": "Active",
        "inactive": "Inactive",
        "yes": "Yes",
        "no": "No",
        "notSet": "—"
    }
}
```

- [ ] **Step 3: Add Sidebar label in zh.json**

In `messages/zh.json`, in the `"Sidebar"` block (around line 962), add after `"articles": "文章"`:

```json
"hardwares": "硬件",
```

- [ ] **Step 4: Replace workers.hardware block and add Data.hardwares block in zh.json**

Same structure as en.json. Replace the existing `"hardware"` block inside `"workers"` with:

```json
"hardware": {
    "title": "硬件资产",
    "empty": "未分配硬件"
}
```

Add a `"hardwares"` block inside `"Data"`:

```json
"hardwares": {
    "title": "硬件",
    "subtitle": "{active} 活跃 / {total} 总计",
    "searchPlaceholder": "搜索序列号、资产标签或分配人...",
    "filterModelCategory": "型号类别",
    "filterAssetStatus": "资产状态",
    "filterRegion": "区域",
    "filterAll": "全部",
    "showInactive": "显示已停用",
    "empty": "未找到硬件资产",
    "unassigned": "未分配",
    "detail": {
        "backToList": "返回硬件列表",
        "identity": "标识",
        "model": "型号",
        "assignment": "分配",
        "locationOrg": "位置 / 组织",
        "cost": "成本",
        "status": "状态",
        "verification": "验证",
        "provenance": "来源",
        "serialNumber": "序列号",
        "assetTag": "资产标签",
        "assetNumber": "资产编号",
        "modelCategory": "型号类别",
        "modelDisplayName": "型号显示名",
        "modelName": "型号名称",
        "mainCategory": "主类别",
        "assetFunction": "资产功能",
        "assetOwner": "资产所有者",
        "assignedToUsername": "分配给（用户名）",
        "assignedToDisplayName": "分配给",
        "employmentType": "雇佣类型",
        "employmentStartDate": "入职日期",
        "assignedDate": "分配日期",
        "firstAssignedDate": "首次分配日期",
        "workerOid": "员工",
        "company": "公司",
        "businessGroup": "业务组",
        "department": "部门",
        "location": "位置",
        "officeId": "办公室ID",
        "regionCode": "区域代码",
        "region": "区域",
        "officeRegion": "办公区域",
        "stockRoom": "库房",
        "costValue": "成本",
        "costCenter": "成本中心",
        "procuredCostCenter": "采购成本中心",
        "residualValue": "残值",
        "residualDate": "残值日期",
        "budgetByOit": "OIT预算",
        "costByOit": "OIT成本",
        "assetStatus": "资产状态",
        "substatus": "子状态",
        "retiredDate": "退役日期",
        "scheduledRetirement": "计划退役",
        "verificationStatus": "验证状态",
        "verifiedDate": "验证日期",
        "verifiedBy": "验证人",
        "erpCreatedBy": "ERP创建者",
        "erpCreatedDate": "ERP创建日期",
        "erpUpdatedDate": "ERP更新日期",
        "ownedBy": "拥有者",
        "active": "活跃",
        "inactive": "已停用",
        "yes": "是",
        "no": "否",
        "notSet": "—"
    }
}
```

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/zh.json
git commit -m "feat(hardware): add i18n strings for hardware list and detail pages"
```

---

### Task 6: Create Hardware List Page

**Files:**
- Create: `app/(main)/data/hardwares/page.tsx`
- Create: `app/(main)/data/hardwares/HardwaresListPage.tsx`

- [ ] **Step 1: Create the server component wrapper**

Create `app/(main)/data/hardwares/page.tsx`:

```typescript
/**
 * Hardwares list page.
 */

import { HardwaresListPage } from './HardwaresListPage';

export default function HardwaresPage() {
    return <HardwaresListPage />;
}
```

- [ ] **Step 2: Create the client component**

Create `app/(main)/data/hardwares/HardwaresListPage.tsx`:

```typescript
'use client';

/**
 * Hardwares list page client component.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    HardDrive,
    RefreshCw,
    Search,
    Check,
    X,
    Loader2,
    Laptop,
    Monitor,
    Smartphone,
    Box,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import { InfiniteLoadTrigger } from '@/components/data/InfiniteLoadTrigger';
import type { Hardware } from '@/lib/types/objects';

function getHardwareIcon(modelCategory: string | null) {
    const cat = (modelCategory ?? '').toLowerCase();
    if (cat.includes('laptop') || cat.includes('notebook') || cat.includes('macbook')) return Laptop;
    if (cat.includes('monitor') || cat.includes('display') || cat.includes('screen')) return Monitor;
    if (cat.includes('phone') || cat.includes('mobile') || cat.includes('iphone')) return Smartphone;
    return Box;
}

function getStatusColor(status: string | null): string {
    switch (status) {
        case 'In use':
            return 'bg-green-500/10 text-green-500 border-green-500/20';
        case 'Retired':
            return 'bg-red-500/10 text-red-500 border-red-500/20';
        default:
            return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
    }
}

export function HardwaresListPage() {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');
    const [modelCategoryFilter, setModelCategoryFilter] = useState<string | null>(null);
    const [assetStatusFilter, setAssetStatusFilter] = useState<string | null>(null);
    const [regionFilter, setRegionFilter] = useState<string | null>(null);

    const {
        items: hardwares,
        total: totalHardwares,
        isInitialLoading,
        isLoadingMore,
        error,
        hasMore,
        loadMore,
        reload,
    } = useInfiniteResource<Hardware>('hardwares', {
        pageSize: 50,
        auto: true,
    });

    // Derive unique filter options from loaded data
    const modelCategories = useMemo(
        () => Array.from(new Set(hardwares.map(h => h.model_category).filter(Boolean) as string[])).sort(),
        [hardwares]
    );

    const assetStatuses = useMemo(
        () => Array.from(new Set(hardwares.map(h => h.asset_status).filter(Boolean) as string[])).sort(),
        [hardwares]
    );

    const regions = useMemo(
        () => Array.from(new Set(hardwares.map(h => h.region).filter(Boolean) as string[])).sort(),
        [hardwares]
    );

    const filteredHardwares = useMemo(() => {
        return hardwares.filter((h) => {
            const q = searchQuery.toLowerCase();
            const matchesSearch =
                searchQuery === '' ||
                (h.serial_number && h.serial_number.toLowerCase().includes(q)) ||
                (h.asset_tag && h.asset_tag.toLowerCase().includes(q)) ||
                (h.assigned_to_display_name && h.assigned_to_display_name.toLowerCase().includes(q));

            const matchesCategory = modelCategoryFilter === null || h.model_category === modelCategoryFilter;
            const matchesStatus = assetStatusFilter === null || h.asset_status === assetStatusFilter;
            const matchesRegion = regionFilter === null || h.region === regionFilter;

            return matchesSearch && matchesCategory && matchesStatus && matchesRegion;
        });
    }, [hardwares, searchQuery, modelCategoryFilter, assetStatusFilter, regionFilter]);

    const handleRefresh = () => {
        void reload();
    };

    useEffect(() => {
        if (isInitialLoading || isLoadingMore || !hasMore) return;
        void loadMore();
    }, [hasMore, isInitialLoading, isLoadingMore, loadMore]);

    const totalLabel = useMemo(() => {
        if (typeof totalHardwares === 'number' && Number.isFinite(totalHardwares)) {
            return totalHardwares.toLocaleString();
        }
        if (hasMore) {
            return `${hardwares.length.toLocaleString()}+`;
        }
        return hardwares.length.toLocaleString();
    }, [hasMore, totalHardwares, hardwares.length]);

    const selectClass = `px-3 py-2 text-sm rounded-lg border outline-none ${isLight ? 'bg-white border-slate-200 text-slate-700' : 'bg-white/5 border-white/10 text-white'}`;

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <QuickScrollRail />
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`
                            w-10 h-10 rounded-xl flex items-center justify-center
                            ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}
                        `}>
                            <HardDrive className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {t('hardwares.title')}
                            </h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {hardwares.filter(h => h.is_active).length.toLocaleString()} Active Loaded / {hardwares.length.toLocaleString()} Loaded / {totalLabel} Total
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleRefresh}
                            className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}
                        >
                            <RefreshCw className={`w-5 h-5 ${(isInitialLoading || isLoadingMore) ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder={t('hardwares.searchPlaceholder')}
                            className={`
                                w-full pl-10 pr-4 py-2 rounded-lg
                                ${isLight ? 'bg-slate-100 text-slate-800 placeholder-slate-400' : 'bg-white/10 text-white placeholder-gray-500'}
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50
                            `}
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        <select
                            value={modelCategoryFilter || ''}
                            onChange={(e) => setModelCategoryFilter(e.target.value || null)}
                            className={selectClass}
                        >
                            <option value="">{t('hardwares.filterModelCategory')}</option>
                            {modelCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                        <select
                            value={assetStatusFilter || ''}
                            onChange={(e) => setAssetStatusFilter(e.target.value || null)}
                            className={selectClass}
                        >
                            <option value="">{t('hardwares.filterAssetStatus')}</option>
                            {assetStatuses.map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                        <select
                            value={regionFilter || ''}
                            onChange={(e) => setRegionFilter(e.target.value || null)}
                            className={selectClass}
                        >
                            <option value="">{t('hardwares.filterRegion')}</option>
                            {regions.map(region => (
                                <option key={region} value={region}>{region}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {isInitialLoading && hardwares.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" /> Loading hardwares...
                            </span>
                        </div>
                    ) : error && hardwares.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : filteredHardwares.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            {t('hardwares.empty')}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredHardwares.map((hw) => {
                                const Icon = getHardwareIcon(hw.model_category);
                                return (
                                    <button
                                        key={hw.oid}
                                        onClick={() => router.push(`/data/hardwares/${hw.oid}`)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`
                                                w-10 h-10 rounded-full flex items-center justify-center
                                                ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}
                                            `}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <div className={`font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                    {hw.serial_number}
                                                </div>
                                                <div className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                    {hw.model_display_name || hw.model_category || '—'}
                                                    {hw.asset_tag ? ` • ${hw.asset_tag}` : ''}
                                                    {' • '}
                                                    {hw.assigned_to_display_name || t('hardwares.unassigned')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {hw.asset_status && (
                                                <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(hw.asset_status)}`}>
                                                    {hw.asset_status}
                                                </span>
                                            )}
                                            {hw.is_active ? (
                                                <span className="flex items-center gap-1 text-xs text-green-500">
                                                    <Check className="w-3 h-3" /> Active
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs text-red-500">
                                                    <X className="w-3 h-3" /> Inactive
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {hasMore && (
                    <InfiniteLoadTrigger
                        disabled={isInitialLoading || isLoadingMore}
                        onVisible={() => void loadMore()}
                    />
                )}

                {isLoadingMore && (
                    <div className={`py-4 text-center text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading more hardwares...
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Verify the page compiles**

Run: `npx next build 2>&1 | grep -E "error|Error|hardwares" | head -10`
Expected: No errors for the hardwares page (build may take a while)

- [ ] **Step 4: Commit**

```bash
git add app/\(main\)/data/hardwares/page.tsx app/\(main\)/data/hardwares/HardwaresListPage.tsx
git commit -m "feat(hardware): add standalone hardware list page"
```

---

### Task 7: Create Hardware Detail Page

**Files:**
- Create: `app/(main)/data/hardwares/[oid]/page.tsx`
- Create: `app/(main)/data/hardwares/[oid]/HardwareDetailPage.tsx`

- [ ] **Step 1: Create the server component**

Create `app/(main)/data/hardwares/[oid]/page.tsx`:

```typescript
/**
 * Hardware detail page - Server Component.
 */

import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getHardware } from '@/lib/api/objects';
import { HardwareDetailPage } from './HardwareDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function HardwarePage({ params }: PageProps) {
    const { oid } = await params;

    let hardware: Awaited<ReturnType<typeof getHardware>>;
    try {
        hardware = await getHardware(oid);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }

    return <HardwareDetailPage hardware={hardware} />;
}
```

- [ ] **Step 2: Create the client component**

Create `app/(main)/data/hardwares/[oid]/HardwareDetailPage.tsx`:

```typescript
'use client';

/**
 * Hardware detail page client component — read-only, 8 clustered card layout.
 */

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
    ArrowLeft,
    HardDrive,
    Check,
    X,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import type { Hardware } from '@/lib/types/objects';

interface HardwareDetailPageProps {
    hardware: Hardware;
}

function formatCurrency(value: string | null): string {
    if (!value) return '—';
    const num = parseFloat(value);
    if (!Number.isFinite(num)) return value;
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function HardwareDetailPage({ hardware }: HardwareDetailPageProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const t = useTranslations('Data.hardwares.detail');
    const isLight = theme === 'light';
    const notSet = t('notSet');

    const cardClass = `rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`;
    const headingClass = `text-lg font-semibold mb-4 ${isLight ? 'text-slate-800' : 'text-white'}`;
    const labelClass = `text-xs font-medium uppercase tracking-wide mb-1 ${isLight ? 'text-slate-400' : 'text-gray-500'}`;
    const valueClass = `text-sm ${isLight ? 'text-slate-800' : 'text-white'}`;

    function Field({ label, value }: { label: string; value: string | null | undefined }) {
        return (
            <div>
                <div className={labelClass}>{label}</div>
                <div className={valueClass}>{value || notSet}</div>
            </div>
        );
    }

    function BoolField({ label, value }: { label: string; value: boolean | null | undefined }) {
        if (value === null || value === undefined) {
            return <Field label={label} value={null} />;
        }
        return (
            <div>
                <div className={labelClass}>{label}</div>
                <span className={`inline-flex items-center gap-1 text-sm ${value ? 'text-green-500' : isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                    {value ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {value ? t('yes') : t('no')}
                </span>
            </div>
        );
    }

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/data/hardwares')}
                        className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center
                        ${isLight ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400'}
                    `}>
                        <HardDrive className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {hardware.serial_number}
                            </h1>
                            {hardware.is_active ? (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-500 border border-green-500/20">
                                    {t('active')}
                                </span>
                            ) : (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
                                    {t('inactive')}
                                </span>
                            )}
                        </div>
                        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            {hardware.model_display_name || hardware.model_category || '—'}
                        </p>
                    </div>
                </div>

                {/* Identity */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('identity')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('serialNumber')} value={hardware.serial_number} />
                        <Field label={t('assetTag')} value={hardware.asset_tag} />
                        <Field label={t('assetNumber')} value={hardware.asset_number} />
                    </div>
                </div>

                {/* Model */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('model')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('modelCategory')} value={hardware.model_category} />
                        <Field label={t('modelDisplayName')} value={hardware.model_display_name} />
                        <Field label={t('modelName')} value={hardware.model_name} />
                        <Field label={t('mainCategory')} value={hardware.main_category} />
                        <Field label={t('assetFunction')} value={hardware.asset_function} />
                        <Field label={t('assetOwner')} value={hardware.asset_owner} />
                    </div>
                </div>

                {/* Assignment */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('assignment')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('assignedToDisplayName')} value={hardware.assigned_to_display_name} />
                        <Field label={t('assignedToUsername')} value={hardware.assigned_to_username} />
                        <div>
                            <div className={labelClass}>{t('workerOid')}</div>
                            {hardware.worker_oid ? (
                                <button
                                    onClick={() => router.push(`/data/workers/${hardware.worker_oid}`)}
                                    className="text-sm text-blue-500 hover:underline"
                                >
                                    {hardware.worker_oid}
                                </button>
                            ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-500/10 text-gray-500 border border-gray-500/20">
                                    Unassigned
                                </span>
                            )}
                        </div>
                        <Field label={t('employmentType')} value={hardware.employment_type} />
                        <Field label={t('employmentStartDate')} value={hardware.employment_start_date} />
                        <Field label={t('assignedDate')} value={hardware.assigned_date} />
                        <Field label={t('firstAssignedDate')} value={hardware.first_assigned_date} />
                    </div>
                </div>

                {/* Location / Org */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('locationOrg')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('company')} value={hardware.company} />
                        <Field label={t('businessGroup')} value={hardware.business_group} />
                        <Field label={t('department')} value={hardware.department} />
                        <Field label={t('location')} value={hardware.location} />
                        <Field label={t('officeId')} value={hardware.office_id} />
                        <Field label={t('regionCode')} value={hardware.region_code} />
                        <Field label={t('region')} value={hardware.region} />
                        <Field label={t('officeRegion')} value={hardware.office_region} />
                        <Field label={t('stockRoom')} value={hardware.stock_room} />
                    </div>
                </div>

                {/* Cost */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('cost')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('costValue')} value={formatCurrency(hardware.cost)} />
                        <Field label={t('costCenter')} value={hardware.cost_center} />
                        <Field label={t('procuredCostCenter')} value={hardware.procured_cost_center} />
                        <Field label={t('residualValue')} value={formatCurrency(hardware.residual_value)} />
                        <Field label={t('residualDate')} value={hardware.residual_date} />
                        <BoolField label={t('budgetByOit')} value={hardware.budget_by_oit} />
                        <BoolField label={t('costByOit')} value={hardware.cost_by_oit} />
                    </div>
                </div>

                {/* Status */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('status')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <div className={labelClass}>{t('assetStatus')}</div>
                            {hardware.asset_status ? (
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium border ${
                                    hardware.asset_status === 'In use'
                                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                        : hardware.asset_status === 'Retired'
                                            ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                            : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                }`}>
                                    {hardware.asset_status}
                                </span>
                            ) : (
                                <div className={valueClass}>{notSet}</div>
                            )}
                        </div>
                        <Field label={t('substatus')} value={hardware.substatus} />
                        <Field label={t('retiredDate')} value={hardware.retired_date} />
                        <Field label={t('scheduledRetirement')} value={hardware.scheduled_retirement} />
                    </div>
                </div>

                {/* Verification */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('verification')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('verificationStatus')} value={hardware.verification_status} />
                        <Field label={t('verifiedDate')} value={hardware.verified_date} />
                        <Field label={t('verifiedBy')} value={hardware.verified_by} />
                    </div>
                </div>

                {/* Provenance */}
                <div className={cardClass}>
                    <h2 className={headingClass}>{t('provenance')}</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <Field label={t('erpCreatedBy')} value={hardware.erp_created_by} />
                        <Field label={t('erpCreatedDate')} value={hardware.erp_created_date} />
                        <Field label={t('erpUpdatedDate')} value={hardware.erp_updated_date} />
                        <Field label={t('ownedBy')} value={hardware.owned_by} />
                    </div>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(main\)/data/hardwares/\[oid\]/page.tsx app/\(main\)/data/hardwares/\[oid\]/HardwareDetailPage.tsx
git commit -m "feat(hardware): add standalone hardware detail page with 8 clustered cards"
```

---

### Task 8: Worker Detail Cleanup

**Files:**
- Modify: `app/(main)/data/workers/[oid]/page.tsx:7,31-37,65`
- Modify: `app/(main)/data/workers/[oid]/WorkerDetailPage.tsx:27-32,40,43-50,864-940`

- [ ] **Step 1: Remove getWorkerHardwares from server page.tsx**

In `app/(main)/data/workers/[oid]/page.tsx`:

1. In the import line (line 7), remove `getWorkerHardwares` from the import:

Change:
```typescript
import { getWorker, getWorkerProfile, getConnectedEdges, getOrganizations, getLocations, getWorkerHardwares } from '@/lib/api/objects';
```
To:
```typescript
import { getWorker, getWorkerProfile, getConnectedEdges, getOrganizations, getLocations } from '@/lib/api/objects';
```

2. In the Promise.all (lines 31–37), remove the `getWorkerHardwares(workerOid)` call and `hardwares` destructuring:

Change:
```typescript
    const [edgesResponse, organizations, locations, hardwares] = await (async () => {
        try {
            return await Promise.all([
                getConnectedEdges(workerOid),
                getOrganizations(),
                getLocations(),
                getWorkerHardwares(workerOid),
            ]);
```
To:
```typescript
    const [edgesResponse, organizations, locations] = await (async () => {
        try {
            return await Promise.all([
                getConnectedEdges(workerOid),
                getOrganizations(),
                getLocations(),
            ]);
```

3. Remove the `hardwares` prop from the JSX (line 65):

Change:
```typescript
            hardwares={hardwares}
```
Remove this line entirely.

- [ ] **Step 2: Remove hardware-related code from WorkerDetailPage.tsx**

In `app/(main)/data/workers/[oid]/WorkerDetailPage.tsx`:

1. Remove hardware-related icon imports (lines 27–32). Remove `Laptop`, `Monitor`, `Smartphone`, `Mouse`, `Keyboard`, `Headphones`, `Box` from the import block. (Keep only icons still used elsewhere in the file — check if any are used outside the hardware section; `Check` and `X` are used for active/inactive badges so keep those.)

2. Remove `WorkerHardware` from the type import (line 40):

Change:
```typescript
import type { Worker, WorkerProfile, WorkerProfileUpsert, WorkerProfileTopicItem, GlobalEdge, Organization, Location, WorkerHardware } from '@/lib/types/objects';
```
To:
```typescript
import type { Worker, WorkerProfile, WorkerProfileUpsert, WorkerProfileTopicItem, GlobalEdge, Organization, Location } from '@/lib/types/objects';
```

3. Remove `hardwares` from the props interface (line 49):

Change:
```typescript
interface WorkerDetailPageProps {
    worker: Worker;
    workerProfile: WorkerProfile | null;
    edges: GlobalEdge[];
    organizations: Organization[];
    locations: Location[];
    hardwares: WorkerHardware[];
}
```
To:
```typescript
interface WorkerDetailPageProps {
    worker: Worker;
    workerProfile: WorkerProfile | null;
    edges: GlobalEdge[];
    organizations: Organization[];
    locations: Location[];
}
```

4. Remove `hardwares` from the destructured props in the component function signature.

5. Remove the entire `{/* Hardware Assets */}` section (lines 864–940).

- [ ] **Step 3: Verify the worker detail page still compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "WorkerDetail\|worker.*page\|hardware" | head -10`
Expected: No errors related to hardware or the worker detail page

- [ ] **Step 4: Commit**

```bash
git add app/\(main\)/data/workers/\[oid\]/page.tsx app/\(main\)/data/workers/\[oid\]/WorkerDetailPage.tsx
git commit -m "feat(hardware): remove hardware section from worker detail page"
```

---

### Task 9: Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript compilation check**

Run: `npx tsc --noEmit 2>&1 | tail -20`
Expected: No errors

- [ ] **Step 2: Run Next.js build**

Run: `npx next build 2>&1 | tail -30`
Expected: Build succeeds, all pages compile including `/data/hardwares` and `/data/hardwares/[oid]`

- [ ] **Step 3: Run Docker build to verify container works**

Run:
```bash
docker build -t it-aware-frontend:latest .
docker run -d -p 3007:3000 --network dev-net --env-file ./.env.docker --name it-aware-frontend it-aware-frontend:latest
```
Expected: Container starts and serves pages

- [ ] **Step 4: Verify hardware list page loads**

Open browser or curl: `http://localhost:3007/data/hardwares`
Expected: Hardware list page renders (may show empty if backend isn't running, but no JS errors)

- [ ] **Step 5: Clean up test container**

```bash
docker stop it-aware-frontend && docker rm it-aware-frontend
```
