/**
 * Client-side aggregation for the Ops Dashboard.
 *
 * Phase 1 has no backend aggregation endpoints, so KPIs and chart data
 * are computed in the browser from the slim list responses. These
 * functions are intentionally pure so pages/tests can call them
 * directly over any TicketRow[] / HardwareRow[] slice.
 */

import type { HardwareRow, TicketRow } from '@/lib/api/ops_dashboard';

// =============================================================================
// Shared state predicates
// =============================================================================

/**
 * Active-ticket states. Mirrors the mix of ServiceNow state labels the
 * ops prototype used across incidents and requests. The set is
 * intentionally permissive — anything else (Resolved / Closed /
 * Cancelled / etc.) counts as inactive.
 */
const ACTIVE_STATES = new Set<string>([
    'New',
    'In Progress',
    'On Hold',
    'Solution Proposed',
    'Open',
    'Work in Progress',
    'Pending',
]);

export function isActiveState(state: string | null | undefined): boolean {
    if (!state) return false;
    return ACTIVE_STATES.has(state);
}

// =============================================================================
// Request-type classifier (Phase 1 client-side)
// =============================================================================

export type RequestType = 'asset_task' | 'catalog_task' | 'generic';

/**
 * Phase 1 heuristic: requests don't carry a server-side request_type
 * yet, so classify via substring match on item + request_item.
 * Phase 2 adds a real column that supersedes this.
 */
export function classifyRequestType(row: TicketRow): RequestType {
    const text = `${row.item ?? ''} ${row.request_item ?? ''}`.toLowerCase();
    if (/asset|hardware|device/.test(text)) return 'asset_task';
    if (row.item || row.request_item) return 'catalog_task';
    return 'generic';
}

// =============================================================================
// Aging helpers
// =============================================================================

/** Whole days between `updated_at` and now, floored. Returns 0 for unparseable input. */
export function daysSinceUpdated(row: { updated_at: string }, now: number = Date.now()): number {
    const t = Date.parse(row.updated_at);
    if (!Number.isFinite(t)) return 0;
    const diff = now - t;
    if (diff <= 0) return 0;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// =============================================================================
// Ticket KPIs
// =============================================================================

export interface KpiSummary {
    totalActive: number;
    incidentActive: number;
    requestActive: number;
    vipActive: number;
    /** Incidents updated >2 days ago (orange tier is >2d, red tier is >7d). */
    agingIncidentGt2d: number;
    /** Catalog tasks updated >30 days ago. */
    agingCatalogGt30d: number;
    /** Asset tasks updated >30 days ago. */
    agingAssetGt30d: number;
}

export function summarizeTickets(rows: TicketRow[], now: number = Date.now()): KpiSummary {
    let totalActive = 0;
    let incidentActive = 0;
    let requestActive = 0;
    let vipActive = 0;
    let agingIncidentGt2d = 0;
    let agingCatalogGt30d = 0;
    let agingAssetGt30d = 0;

    for (const row of rows) {
        if (!isActiveState(row.state)) continue;

        totalActive += 1;
        if (row.object_type === 'incident') incidentActive += 1;
        else if (row.object_type === 'request') requestActive += 1;

        // VIP detection. The slim view doesn't currently carry a flat
        // is_vip field; backends that join the caller worker surface
        // it on the actor. We check both paths defensively.
        const actorIsVip =
            (row as unknown as { is_vip?: boolean }).is_vip === true ||
            (row.actor as unknown as { is_vip?: boolean } | null)?.is_vip === true;
        if (actorIsVip) vipActive += 1;

        const days = daysSinceUpdated(row, now);

        if (row.object_type === 'incident' && days > 2) {
            agingIncidentGt2d += 1;
        } else if (row.object_type === 'request') {
            const rt = classifyRequestType(row);
            if (days > 30) {
                if (rt === 'asset_task') agingAssetGt30d += 1;
                else if (rt === 'catalog_task') agingCatalogGt30d += 1;
            }
        }
    }

    return {
        totalActive,
        incidentActive,
        requestActive,
        vipActive,
        agingIncidentGt2d,
        agingCatalogGt30d,
        agingAssetGt30d,
    };
}

// =============================================================================
// Generic grouping / trends
// =============================================================================

export interface GroupCount {
    key: string;
    count: number;
}

/**
 * Count rows by `keyFn(row)`, sorted descending by count. `null` and
 * empty-string keys are bucketed as `"Unknown"` so charts don't break.
 */
export function groupBy<T>(rows: T[], keyFn: (row: T) => string | null | undefined): GroupCount[] {
    const counts = new Map<string, number>();
    for (const row of rows) {
        const raw = keyFn(row);
        const key = raw && raw.trim().length > 0 ? raw : 'Unknown';
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count);
}

export interface TrendPoint {
    /** ISO date string for the month's first day (e.g. "2026-03-01"). */
    bucket: string;
    count: number;
}

function monthStart(iso: string): string | null {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return null;
    const d = new Date(t);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
}

function addMonthsUtc(base: Date, delta: number): Date {
    return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + delta, 1));
}

/**
 * Trailing `monthCount`-month trend (inclusive of the current month),
 * bucketed by `created_at`. Months with zero rows are filled in so the
 * chart renders a continuous axis.
 */
export function trendByMonth(
    rows: Array<{ created_at: string }>,
    monthCount: number = 10,
    now: number = Date.now(),
): TrendPoint[] {
    if (monthCount <= 0) return [];

    const counts = new Map<string, number>();
    for (const row of rows) {
        const bucket = monthStart(row.created_at);
        if (!bucket) continue;
        counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }

    const nowDate = new Date(now);
    const currentMonth = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1));
    const out: TrendPoint[] = [];
    for (let i = monthCount - 1; i >= 0; i -= 1) {
        const d = addMonthsUtc(currentMonth, -i);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        const bucket = `${y}-${m}-01`;
        out.push({ bucket, count: counts.get(bucket) ?? 0 });
    }
    return out;
}

// =============================================================================
// Asset helpers
// =============================================================================

export type DeviceType = 'Mac' | 'Windows' | 'Other';

export function inferDeviceType(modelName: string | null | undefined): DeviceType {
    if (!modelName) return 'Other';
    const s = modelName.toLowerCase();
    if (s.includes('mac')) return 'Mac';
    if (s.includes('win')) return 'Windows';
    return 'Other';
}

export function isInStock(row: HardwareRow): boolean {
    const s = row.asset_status?.toLowerCase() ?? '';
    return s === 'in stock' || s === '(60)';
}

export function isPendingReturn(row: HardwareRow): boolean {
    return (row.substatus?.toLowerCase() ?? '').includes('pending return');
}

export function isPendingRepair(row: HardwareRow): boolean {
    return (row.substatus?.toLowerCase() ?? '').includes('pending repair');
}

/**
 * "Unconfirmed" assets — any substatus containing the word
 * "unconfirmed" / "pending confirmation" per the prototype A.8 table.
 */
export function isUnconfirmed(row: HardwareRow): boolean {
    const s = row.substatus?.toLowerCase() ?? '';
    return s.includes('unconfirmed') || s.includes('pending confirmation');
}

export function isZeroResidual(row: HardwareRow): boolean {
    const v = row.residual_value;
    if (v === null || v === undefined) return true;
    if (typeof v === 'number') return v === 0;
    // residual_value may arrive as a string from the backend — guard both.
    const n = Number(v);
    return !Number.isFinite(n) || n === 0;
}

export interface AssetKpis {
    total: number;
    inStock: number;
    /** 0–100, rounded to the nearest integer. */
    inStockRatePct: number;
    pendingReturn: number;
    pendingRepair: number;
    unconfirmed: number;
    zeroResidual: number;
}

export function summarizeAssets(rows: HardwareRow[]): AssetKpis {
    let inStock = 0;
    let pendingReturn = 0;
    let pendingRepair = 0;
    let unconfirmed = 0;
    let zeroResidual = 0;

    for (const row of rows) {
        if (isInStock(row)) inStock += 1;
        if (isPendingReturn(row)) pendingReturn += 1;
        if (isPendingRepair(row)) pendingRepair += 1;
        if (isUnconfirmed(row)) unconfirmed += 1;
        if (isZeroResidual(row)) zeroResidual += 1;
    }

    const total = rows.length;
    const inStockRatePct = total === 0 ? 0 : Math.round((inStock / total) * 100);

    return {
        total,
        inStock,
        inStockRatePct,
        pendingReturn,
        pendingRepair,
        unconfirmed,
        zeroResidual,
    };
}
