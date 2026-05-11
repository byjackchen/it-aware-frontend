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
/**
 * Canonical business-wise active state list. Exported so dashboard pages
 * that want an "open tickets only" fetch can pass it directly to the
 * backend's multi-value `states_list` filter — keeping frontend and
 * backend aligned on exactly which states count as active.
 */
export const ACTIVE_STATES: readonly string[] = [
    'New',
    'In Progress',
    'On Hold',
    'Solution Proposed',
    'Open',
    'Work in Progress',
    'Pending',
] as const;

const ACTIVE_STATES_SET = new Set<string>(ACTIVE_STATES);

export function isActiveState(state: string | null | undefined): boolean {
    if (!state) return false;
    return ACTIVE_STATES_SET.has(state);
}

// =============================================================================
// Request-type classifier (Phase 1 client-side)
// =============================================================================

export type RequestType = 'asset_task' | 'catalog_task' | 'generic';

/**
 * Phase 1 heuristic: requests don't carry a server-side request_type
 * yet, so classify via:
 *   1. SN ticket-number prefix on ``stable_id`` — the authoritative
 *      signal. ServiceNow numbers asset tasks ``ASTTASK*`` and
 *      regular service catalog tasks ``SCTASK*``. Prefix beats text
 *      heuristics (e.g. an SCTASK whose item happens to mention
 *      "device" is still a catalog task, not an asset task).
 *   2. Substring match on ``item`` / ``request_item`` — used only
 *      when the prefix is unrecognised (legacy / non-SN sources).
 *
 * When neither signal matches, default to ``catalog_task`` — rows
 * without a populated item field are still SN service catalog
 * requests; they're just miscellaneous entries the catalog didn't
 * pre-fill the item attribute for. Treating them as ``generic`` led
 * to a gap on the Active Monitoring Hub where ``totalActive`` (all
 * request types) exceeded the sum of the three bucket KPIs by the
 * row count of unclassified requests.
 *
 * Phase 2 adds a real column that supersedes this heuristic.
 */
export function classifyRequestType(row: TicketRow): RequestType {
    // 1. ServiceNow ticket-number prefix is authoritative.
    const sid = (row.stable_id ?? '').toUpperCase();
    if (sid.startsWith('ASTTASK')) return 'asset_task';
    if (sid.startsWith('SCTASK')) return 'catalog_task';

    // 2. Fallback: keyword-sniff item / request_item for non-SN sources.
    const text = `${row.item ?? ''} ${row.request_item ?? ''}`.toLowerCase();
    if (/asset|hardware|device/.test(text)) return 'asset_task';

    // 3. Default — see module docstring above for rationale.
    return 'catalog_task';
}

// =============================================================================
// Aging helpers
// =============================================================================

/**
 * Days since the upstream system (ServiceNow) last updated the row.
 *
 * Phase 2 aging clock: prefer ``source_updated_at`` — that mirrors SN's
 * ``sys_updated_on`` and bumps only when the upstream record actually
 * changes. Fall back to ``updated_at`` (the DB-row lifecycle timestamp)
 * only when ``source_updated_at`` is null — a pre-backfill row or a
 * non-SN activity source (inquiry / interaction from chat).
 *
 * Never aging off ``updated_at`` alone: after Phase 2 that field bumps
 * on every DB mutation (``onupdate=func.now()``) including internal
 * edits that do not reflect upstream activity.
 */
export function daysSinceUpdated(
    row: { source_updated_at?: string | null; updated_at: string },
    now: number = Date.now(),
): number {
    const iso = row.source_updated_at ?? row.updated_at;
    const t = Date.parse(iso);
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
    // Index signature so this type is assignable to the chart's loose
    // `TrendChartRow` shape — useful when the same chart component
    // accepts both single-series and multi-series payloads.
    [key: string]: string | number;
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
 * Derive a month-bucket count from a date-range filter so the trend
 * chart horizon matches whatever window the user is looking at. Falls
 * back to ``fallback`` when no ``from`` is set.
 */
export function monthsFromRange(
    from: string | null | undefined,
    to: string | null | undefined,
    now: number = Date.now(),
    fallback: number = 3,
): number {
    if (!from) return fallback;
    const fromMs = Date.parse(from);
    if (!Number.isFinite(fromMs)) return fallback;
    const toMs = to ? Date.parse(to) : now;
    const endMs = Number.isFinite(toMs) ? toMs : now;
    const diffDays = Math.max(0, (endMs - fromMs) / (1000 * 60 * 60 * 24));
    // Round up so a 3-month window covers 3 full buckets including the
    // current month. Clamp to 1..36 for chart readability.
    const months = Math.ceil(diffDays / 30.436875) + 1;
    return Math.min(36, Math.max(1, months));
}

/** Cumulative-trend data point — paired opened + closed totals through the bucket month. */
export interface CumulativeTrendPoint {
    /** ISO date string for the month's first day. */
    bucket: string;
    /** Cumulative tickets created up to and including this month. */
    opened: number;
    /** Cumulative tickets closed up to and including this month. */
    closed: number;
    // Index signature for chart-component assignability — see TrendPoint.
    [key: string]: string | number;
}

/**
 * Trailing `monthCount`-month *cumulative* trend bucketed by month.
 * Returns paired (opened, closed) running totals so each point reflects
 * the lifetime-to-date of the row set as of that month-end.
 *
 * Properties:
 *   - Both series are non-decreasing.
 *   - `closed[i] <= opened[i]` always (the gap is the active count at
 *     that point in time).
 *   - The first displayed month already includes all rows opened /
 *     closed BEFORE the window — we don't reset the cumulative count
 *     when the user narrows the date range.
 *
 * `closedAtFor` extracts the closure timestamp from a row — typically
 * `source_closed_at ?? source_resolved_at` for incidents, or just
 * `source_closed_at` for requests. Rows whose extractor returns null
 * are treated as still open.
 */
export function cumulativeTrendByMonth<T extends { created_at: string }>(
    rows: T[],
    closedAtFor: (row: T) => string | null | undefined,
    monthCount: number = 10,
    now: number = Date.now(),
): CumulativeTrendPoint[] {
    if (monthCount <= 0) return [];

    // Per-month deltas — how many tickets opened / closed in each month.
    const openedDelta = new Map<string, number>();
    const closedDelta = new Map<string, number>();
    for (const row of rows) {
        const oBucket = monthStart(row.created_at);
        if (oBucket) openedDelta.set(oBucket, (openedDelta.get(oBucket) ?? 0) + 1);
        const cAt = closedAtFor(row);
        if (cAt) {
            const cBucket = monthStart(cAt);
            if (cBucket) closedDelta.set(cBucket, (closedDelta.get(cBucket) ?? 0) + 1);
        }
    }

    // Build the list of bucket strings for the visible window.
    const nowDate = new Date(now);
    const currentMonth = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), 1));
    const buckets: string[] = [];
    for (let i = monthCount - 1; i >= 0; i -= 1) {
        const d = addMonthsUtc(currentMonth, -i);
        const y = d.getUTCFullYear();
        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
        buckets.push(`${y}-${m}-01`);
    }

    // Pre-window cumulative starting point — count rows whose bucket is
    // before the first displayed bucket so the chart begins at the
    // running lifetime total, not zero.
    const firstBucket = buckets[0];
    let openedCumul = 0;
    let closedCumul = 0;
    for (const [b, c] of openedDelta) if (b < firstBucket) openedCumul += c;
    for (const [b, c] of closedDelta) if (b < firstBucket) closedCumul += c;

    const out: CumulativeTrendPoint[] = [];
    for (const bucket of buckets) {
        openedCumul += openedDelta.get(bucket) ?? 0;
        closedCumul += closedDelta.get(bucket) ?? 0;
        out.push({ bucket, opened: openedCumul, closed: closedCumul });
    }
    return out;
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
// Month-over-month delta
// =============================================================================

const DAY_MS = 86_400_000;

export interface MoMResult {
    /** Count in the current rolling 30-day window (now − 30d, now]. */
    current: number;
    /** Count in the prior rolling 30-day window (now − 60d, now − 30d]. */
    previous: number;
}

export interface DeltaInfo {
    /** Rounded percentage change from previous → current. */
    pct: number;
    trend: 'up' | 'down' | 'flat';
    /** Locale-neutral compact fallback; UI components should format via i18n. */
    formatted: string;
}

function isoInRangeMs(iso: string | null | undefined, fromMs: number, toMs: number): boolean {
    if (!iso) return false;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return false;
    return t > fromMs && t <= toMs;
}

/**
 * Volume MoM — count of rows whose `getDate(row)` timestamp falls in
 * the trailing 30-day window vs the 30-day window before that. Useful
 * for "tickets opened" style KPIs.
 */
export function momByDate<T>(
    rows: T[],
    getDate: (row: T) => string | null | undefined,
    now: number = Date.now(),
): MoMResult {
    const lastMo = now - 30 * DAY_MS;
    const prevMo = now - 60 * DAY_MS;
    let current = 0;
    let previous = 0;
    for (const row of rows) {
        const iso = getDate(row);
        if (!iso) continue;
        if (isoInRangeMs(iso, lastMo, now)) current += 1;
        else if (isoInRangeMs(iso, prevMo, lastMo)) previous += 1;
    }
    return { current, previous };
}

/**
 * Was a ticket open at the snapshot time `atMs`? Combines created_at
 * (must be ≤ atMs) with whichever closure timestamp the row carries.
 *
 * The dump can be missing `source_closed_at` / `source_resolved_at`
 * even when the state is "Closed Complete"; in that case we fall back
 * to `source_updated_at`/`updated_at` as a closure-time proxy. Same
 * heuristic the cumulative-trend chart uses.
 */
function wasActiveAt(row: TicketRow, atMs: number): boolean {
    const createdMs = Date.parse(row.created_at);
    if (!Number.isFinite(createdMs) || createdMs > atMs) return false;
    let closedMs: number | null = null;
    const realClosed = row.source_resolved_at ?? row.source_closed_at;
    if (realClosed) {
        const t = Date.parse(realClosed);
        if (Number.isFinite(t)) closedMs = t;
    } else if (!isActiveState(row.state)) {
        const ts = row.source_updated_at ?? row.updated_at;
        const t = Date.parse(ts);
        if (Number.isFinite(t)) closedMs = t;
    }
    if (closedMs !== null && closedMs <= atMs) return false;
    return true;
}

/**
 * Snapshot MoM for active counts — current active count vs how many
 * rows in the same set were active 30 days ago. The optional
 * `predicate` narrows to a sub-cohort (e.g. VIP only).
 */
export function momActiveSnapshot<T extends TicketRow>(
    rows: T[],
    now: number = Date.now(),
    predicate: (row: T) => boolean = () => true,
): MoMResult {
    const previousAtMs = now - 30 * DAY_MS;
    let current = 0;
    let previous = 0;
    for (const row of rows) {
        if (!predicate(row)) continue;
        if (isActiveState(row.state)) current += 1;
        if (wasActiveAt(row, previousAtMs)) previous += 1;
    }
    return { current, previous };
}

/**
 * Format a {current, previous} pair as a short delta string with an
 * arrow + percentage. Returns `null` when the previous bucket is 0
 * (no meaningful comparison) — callers should skip rendering the
 * delta in that case.
 */
export function formatMoM({ current, previous }: MoMResult): DeltaInfo | null {
    if (previous === 0) return null;
    const pctRaw = ((current - previous) / previous) * 100;
    const pct = Math.round(pctRaw);
    if (pct === 0) {
        return { pct: 0, trend: 'flat', formatted: '0%' };
    }
    const arrow = pct > 0 ? '▲' : '▼';
    return {
        pct,
        trend: pct > 0 ? 'up' : 'down',
        formatted: `${arrow} ${Math.abs(pct)}%`,
    };
}

// =============================================================================
// Asset helpers
// =============================================================================

export type DeviceType = 'Mac' | 'Windows' | 'Other';

/**
 * Whitelist of `model_category` values that count as "IT assets" for
 * the Ops Dashboard. Hardware rows whose model_category falls outside
 * this set (peripherals, accessories, monitors-only, etc.) are filtered
 * out from every asset KPI, donut and bar chart so the numbers reflect
 * only managed IT endpoints.
 *
 * Match is case-insensitive and trims whitespace. Values agreed with
 * the team (2026-05-10):
 *   - Computer
 *   - Laptop
 *   - Desktop
 *   - Server
 *   - Hardware
 */
export const ASSET_MODEL_CATEGORY_WHITELIST: readonly string[] = [
    'computer',
    'laptop',
    'desktop',
    'server',
    'hardware',
];

const ASSET_MODEL_CATEGORY_SET = new Set(ASSET_MODEL_CATEGORY_WHITELIST);

/**
 * Returns true when the hardware row's `model_category` is inside the
 * agreed whitelist. Use this as the FIRST gate when filtering assets
 * for any Ops Dashboard view.
 */
export function isInScopeAsset(row: HardwareRow): boolean {
    const cat = (row.model_category ?? '').toLowerCase().trim();
    if (!cat) return false;
    return ASSET_MODEL_CATEGORY_SET.has(cat);
}

export function inferDeviceType(modelName: string | null | undefined): DeviceType {
    if (!modelName) return 'Other';
    const s = modelName.toLowerCase();
    if (s.includes('mac')) return 'Mac';
    // Brand-based shortcut — anything Lenovo or Dell ships is Windows.
    // Catches naming conventions the model-line keyword list below
    // would otherwise miss (e.g. "Lenovo P620 Workstation",
    // "Dell OptiPlex 7080").
    if (s.includes('lenovo') || s.includes('dell')) return 'Windows';
    if (s.includes('win') || s.includes('thinkpad') || s.includes('latitude') ||
        s.includes('precision') || s.includes('inspiron') || s.includes('xps') ||
        s.includes('probook') || s.includes('elitebook') || s.includes('zbook') ||
        s.includes('surface') || s.includes('aspire') || s.includes('swift') ||
        s.includes('travelmate') || s.includes('zenbook') || s.includes('vivobook') ||
        s.includes('lifetime') || s.includes('lifebook') || s.includes('notebook') ||
        s.includes('pc') || s.includes('laptop')) return 'Windows';
    return 'Other';
}

export function isInStock(row: HardwareRow): boolean {
    // Match the family of in-stock statuses ("In stock", "In stock -
    // available", etc.) rather than the bare string. The dump from
    // ServiceNow surfaces "In stock - available" — the strict equality
    // check used previously dropped 1k+ rows from the In-Stock
    // Location donut, KPI tiles and bar chart.
    const s = row.asset_status?.toLowerCase() ?? '';
    return s.startsWith('in stock') || s === '(60)';
}

/**
 * "Active" hardware as the team defines it: any of the four operational
 * asset_status values minus rows currently sitting in a Legal Hold
 * substatus. Used as the numerator of the In-Stock Rate KPI and as a
 * standalone "Active Assets" tile.
 *
 * State whitelist matches the SN drop-down captured in the team's
 * filter screenshot — `In stock - available` / `Unavailable` /
 * `In use` / `Consumed`. Anything else (Retired / Awaiting Approval /
 * `(66)` placeholder values / etc.) is excluded.
 */
const ACTIVE_ASSET_STATES = new Set([
    'in stock - available',
    'unavailable',
    'in use',
    'consumed',
]);
export function isActiveAsset(row: HardwareRow): boolean {
    const s = (row.asset_status ?? '').toLowerCase().trim();
    if (!ACTIVE_ASSET_STATES.has(s)) return false;
    const sub = (row.substatus ?? '').toLowerCase();
    if (sub.includes('legal hold')) return false;
    return true;
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
    /** Hardware in one of the operational states minus Legal Hold (see isActiveAsset). */
    activeAsset: number;
    /** activeAsset / total — 0–100, rounded to the nearest integer. */
    inStockRatePct: number;
    pendingReturn: number;
    pendingRepair: number;
    unconfirmed: number;
    zeroResidual: number;
}

export function summarizeAssets(rows: HardwareRow[]): AssetKpis {
    let inStock = 0;
    let activeAsset = 0;
    let pendingReturn = 0;
    let pendingRepair = 0;
    let unconfirmed = 0;
    let zeroResidual = 0;

    for (const row of rows) {
        if (isInStock(row)) inStock += 1;
        if (isActiveAsset(row)) activeAsset += 1;
        if (isPendingReturn(row)) pendingReturn += 1;
        if (isPendingRepair(row)) pendingRepair += 1;
        if (isUnconfirmed(row)) unconfirmed += 1;
        if (isZeroResidual(row)) zeroResidual += 1;
    }

    const total = rows.length;
    // In-Stock Rate = inStock ÷ activeAsset — share of the currently
    // operational fleet that is sitting unassigned in a stockroom
    // (vs. handed out to a worker / consumed / unavailable). Falls
    // back to 0 when there are no active rows so the tile shows '—'.
    const inStockRatePct = activeAsset === 0 ? 0 : Math.round((inStock / activeAsset) * 100);

    return {
        total,
        inStock,
        activeAsset,
        inStockRatePct,
        pendingReturn,
        pendingRepair,
        unconfirmed,
        zeroResidual,
    };
}

// =============================================================================
// Duration formatting
// =============================================================================

/**
 * Format a seconds count as "Xd Yh" / "Yh Zm" / "Nm" — picks the
 * coarsest two units that aren't both zero so a 14-day duration reads
 * "14d 3h" instead of "14d 3h 22m 8s".
 *
 *   86_400 → "1d 0h"
 *   90_000 → "1d 1h"
 *    7_200 → "2h 0m"
 *      300 → "5m"
 *        0 → "0m"
 *
 * Returns "—" when the value is null / non-finite / negative — the
 * dashboards use that as the empty-state cell.
 */
export function formatDurationSec(secs: number | null | undefined): string {
    if (secs === null || secs === undefined || !Number.isFinite(secs) || secs < 0) {
        return '—';
    }
    const total = Math.round(secs);
    const days = Math.floor(total / 86_400);
    const hours = Math.floor((total % 86_400) / 3_600);
    const minutes = Math.floor((total % 3_600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

/**
 * Mean of a numeric column over rows where the value is set. Returns
 * `null` when no row has a usable value — the caller can render that
 * as "—" via {@link formatDurationSec}.
 */
export function meanOf<T>(rows: T[], pick: (r: T) => number | null | undefined): number | null {
    let total = 0;
    let count = 0;
    for (const r of rows) {
        const v = pick(r);
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
            total += v;
            count += 1;
        }
    }
    return count === 0 ? null : total / count;
}

/**
 * Sum of a numeric column over rows. Like {@link meanOf} but additive —
 * used for "total time worked across all rows" KPIs.
 */
export function sumOf<T>(rows: T[], pick: (r: T) => number | null | undefined): number {
    let total = 0;
    for (const r of rows) {
        const v = pick(r);
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) total += v;
    }
    return total;
}

// =============================================================================
// Model-family fuzzy classifier
// =============================================================================

/**
 * Bucket a SN model_display_name into a coarse family so the
 * In-Stock Assets bar chart shows a digestible number of bars
 * (~10–15) instead of one bar per SKU (the raw model dimension has
 * hundreds of distinct values).
 *
 * Order matters — we check the most specific patterns first
 * ("MacBook Pro 16" before "MacBook Pro" before plain Apple). The
 * fallback is "Other".
 */
export function modelFamily(modelName: string | null | undefined): string {
    if (!modelName) return 'Unknown';
    const s = modelName.toLowerCase();

    // Apple line — split MacBook Pro / Air / Mac mini / iMac / iPad / iPhone.
    if (s.includes('macbook pro 16')) return 'MacBook Pro 16';
    if (s.includes('macbook pro 14')) return 'MacBook Pro 14';
    if (s.includes('macbook pro 13')) return 'MacBook Pro 13';
    if (s.includes('macbook pro')) return 'MacBook Pro';
    if (s.includes('macbook air')) return 'MacBook Air';
    if (s.includes('mac mini')) return 'Mac mini';
    if (s.includes('imac')) return 'iMac';
    if (s.includes('macbook')) return 'MacBook (other)';
    if (s.includes('ipad')) return 'iPad';
    if (s.includes('iphone')) return 'iPhone';
    if (s.includes('apple')) return 'Apple (other)';

    // Lenovo line — X1 Carbon / Thinkpad / Workstation / generic.
    if (s.includes('x1 carbon')) return 'Lenovo X1 Carbon';
    if (s.includes('thinkpad')) return 'Lenovo Thinkpad';
    if (s.includes('lenovo') && s.includes('workstation')) return 'Lenovo Workstation';
    if (s.includes('lenovo')) return 'Lenovo (other)';

    // Dell line — Latitude / OptiPlex / Precision / monitor / generic.
    if (s.includes('latitude')) return 'Dell Latitude';
    if (s.includes('optiplex')) return 'Dell OptiPlex';
    if (s.includes('precision')) return 'Dell Precision';
    if (s.includes('xps')) return 'Dell XPS';
    if (s.includes('dell') && s.includes('monitor')) return 'Dell Monitor';
    if (s.includes('dell')) return 'Dell (other)';

    // HP / Microsoft / common other vendors.
    if (s.includes('elitebook')) return 'HP EliteBook';
    if (s.includes('probook')) return 'HP ProBook';
    if (s.includes('zbook')) return 'HP ZBook';
    if (s.includes('surface')) return 'Microsoft Surface';

    // Specialty equipment — keep in their own buckets so they don't
    // inflate "Other".
    if (s.includes('mocap')) return 'MOCAP Camera';
    if (s.includes('ps5') || s.includes('playstation')) return 'PlayStation';
    if (s.includes('xbox')) return 'Xbox';
    if (s.includes('nvidia') || s.includes('rtx ') || s.includes('gtx ')) return 'NVIDIA GPU';
    if (s.includes('monitor')) return 'Monitor';
    if (s.includes('custom pc') || s.includes('workstation')) return 'Custom Workstation';

    return 'Other';
}
