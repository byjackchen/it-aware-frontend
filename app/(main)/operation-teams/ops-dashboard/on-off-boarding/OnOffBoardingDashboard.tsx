'use client';

/**
 * On/Offboarding Task Dashboard — New Hire and Offboarding request flow.
 *
 * Layout & patterns mirror CatalogDashboard:
 *   - Page-level header + refresh button
 *   - TopFilterBar (Region/Country/Location in headerSlot, Opened date
 *     range in the slicer grid, consolidated Clear-All)
 *   - KPI row, donut row, department bar + volume trend
 *
 * The one divergence: a two-tab switcher between **Onboarding** and
 * **Offboarding** sits between the filter bar and the scrollable body.
 * Each tab narrows the base request pool via a keyword match on the
 * `item` column (verified against the Postgres dump):
 *   - Onboarding → `item ILIKE '%New Hire%'`   (3051 rows in dev)
 *   - Offboarding → `item ILIKE '%Offboard%'`   (10 rows in dev)
 *
 * Keyword matching happens client-side over the same request fetch
 * Catalog uses (limit=1000 slim). No new endpoint is required.
 */

import { useCallback, useMemo, useState } from 'react';
import { UserPlus, UserMinus, RefreshCw, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useRequests, useHardwares } from '@/lib/hooks/useOpsDashboard';
import { useAllActiveWorkers } from '@/lib/hooks/useAllActiveWorkers';
import type { TicketRow, HardwareRow } from '@/lib/api/ops_dashboard';
import {
    cumulativeTrendByMonth,
    daysSinceUpdated,
    formatMoM,
    groupBy,
    isActiveState,
    isInScopeGroup,
    momActiveSnapshot,
    momByDate,
    monthsFromRange,
    openedAt,
    snDayEndIso,
    snDayStartIso,
    type DeltaInfo,
} from '@/lib/ops_dashboard/aggregate';
import { KpiCard } from '@/components/ops_dashboard/KpiCard';
import { DonutCard } from '@/components/ops_dashboard/DonutCard';
import { GroupBarCard } from '@/components/ops_dashboard/GroupBarCard';
import { TrendLineCard } from '@/components/ops_dashboard/TrendLineCard';
import { DataTableCard, type Column } from '@/components/ops_dashboard/DataTableCard';
import {
    TopFilterBar,
    type FilterState,
    type SlicerConfig,
} from '@/components/ops_dashboard/filters/TopFilterBar';
import { RegionCountryFilter } from '@/components/ops_dashboard/filters/RegionCountryFilter';
import type { Region } from '@/components/ops_dashboard/RegionMap';
import { matchesRegionCountry } from '@/lib/ops_dashboard/region';
import { useOpsGlobalFilter } from '@/lib/hooks/useOpsGlobalFilter';
import { TranslatedAutoRefresh } from '@/components/ops_dashboard/TranslatedAutoRefresh';

/**
 * Two flow kinds exposed as tabs. Values serve as both the tab key and
 * the classifier label surfaced in analytics.
 */
type FlowKind = 'onboarding' | 'offboarding';

/**
 * Per-tab visual palette + classifier predicate.
 *
 * Keyword match is case-insensitive and walks `title` (the SN-side
 * "Short Description"), `item`, and `request_item`. Patterns are
 * deliberately tight so the cohort only contains the two SN-defined
 * offboarding request types — rows whose title merely mentions
 * "offboard" or sit inside an "*onoffboarding*" mailing list group
 * are intentionally excluded; they're DL-management work, not
 * offboarding flow.
 *
 * Color scheme: shared multi-hue palette across both flows so each
 * donut's 8 slices stay visually distinct (the previous single-hue
 * green / amber palettes blurred together at chart size). Mirrors the
 * mixed-hue ``DONUT_PALETTE`` already used by TicketsPanel. Only the
 * accent (KPI delta arrow / chart line color) varies per flow as a
 * subtle in/out cue.
 */
const SHARED_FLOW_PALETTE: string[] = [
    '#3b82f6',
    '#22c55e',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
    '#94a3b8',
];

const FLOW_META: Record<FlowKind, { keywords: string[]; palette: string[]; accent: string }> = {
    onboarding: {
        // Tight — only "New Hire Equipment" titles (Provision / Check
        // Inventory / Ship-Deliver / etc. all carry that phrase). Rows
        // that mention "new hire" tangentially — DL adds, FAQ requests,
        // intern license requests — are excluded so the cohort matches
        // actual equipment-onboarding work.
        keywords: ['new hire equipment'],
        palette: SHARED_FLOW_PALETTE,
        accent: '#22c55e', // green — "welcome / in" cue for the trend line.
    },
    offboarding: {
        // Tight match — the two SN-defined offboarding request titles.
        keywords: ['offboarding: retrieve it equipment', 'offboarding: revoke software'],
        palette: SHARED_FLOW_PALETTE,
        accent: '#f97316', // amber — "exit / out" cue for the trend line.
    },
};

/** Substring-match against `title` / `item` / `request_item` to classify a row. */
function matchesFlow(row: TicketRow, flow: FlowKind): boolean {
    const text = `${row.title ?? ''} ${row.item ?? ''} ${row.request_item ?? ''}`.toLowerCase();
    return FLOW_META[flow].keywords.some((kw) => text.includes(kw));
}

/**
 * Extract the employee identifier from a ticket title.
 *
 * SN's onboarding / offboarding short descriptions follow two patterns:
 *   - Onboarding: "Provision New Hire Equipment For {Full Name}"
 *                 "Check Inventory New Hire Equipment For {Full Name}"
 *   - Offboarding: "Offboarding: Retrieve IT Equipment on YYYY-MM-DD for {user_id}"
 *                  "Offboarding: Revoke Software on YYYY-MM-DD for {user_id}"
 *
 * The captured token is normalised (trim + lowercase) so casing
 * differences across rows ("Adam Swirsley" vs "adam swirsley") collapse
 * onto the same employee. Returns null when no `(F|f)or` separator
 * exists — the caller then skips the row in the distinct count.
 */
function extractEmployeeKey(title: string | null | undefined): string | null {
    if (!title) return null;
    // Match "for " or "For " followed by everything up to end of string.
    const m = title.match(/\b[Ff]or\s+(.+?)\s*$/);
    if (!m) return null;
    const raw = m[1].trim();
    if (!raw) return null;
    return raw.toLowerCase();
}

/**
 * Extract a Last Working Day ISO date (YYYY-MM-DD) from an offboarding
 * SCTASK title. SN templates always carry the date as
 * `... on YYYY-MM-DD for <username>`. Returns null if the title isn't
 * one of the two SN-defined offboarding flavours.
 */
function extractLwdIso(title: string | null | undefined): string | null {
    if (!title) return null;
    const m = title.match(/\bon\s+(\d{4}-\d{2}-\d{2})\s+for\b/);
    return m ? m[1] : null;
}

/**
 * Extract the offboarded user's SN username from an offboarding ticket
 * title — the trailing token after "for". SN renders this as the SN
 * username (e.g. `v_skhoso`, `croegner`) for the standard two
 * "Offboarding: Retrieve IT Equipment / Revoke Software" templates.
 *
 * Returns null when the title doesn't match the offboarding shape.
 * Result is lowercased to make the downstream `assigned_to_username`
 * join case-insensitive.
 */
function extractOffboardingUser(title: string | null | undefined): string | null {
    if (!title) return null;
    // "... for <username>" with optional trailing whitespace.
    const m = title.match(/\bfor\s+([A-Za-z_][A-Za-z0-9_.\-]+)\s*$/);
    if (!m) return null;
    return m[1].trim().toLowerCase();
}

function locationForFilter(row: TicketRow): string | null {
    return row.actor?.location?.descriptor?.trim() || null;
}

function departmentOf(row: TicketRow): string {
    // Offboarding rows carry no `request.department` — that column is
    // null on every offboarding ticket in the dump. The actor's
    // organization descriptor *is* set, but it's the slash-joined full
    // path (`Overseas Functional System/Overseas IT Management Department/
    // Americas IT Center`). Picking the leaf segment surfaces the
    // service team / IT centre the ticket lives in, which is what
    // "by department" means on this page. Falls through to:
    //   1. ticket-anchored department  (catalog/incidents fill this)
    //   2. actor-org leaf segment      (used by offboarding)
    //   3. actor-org full descriptor   (defensive)
    //   4. "Unknown"
    const ticketDept = row.department?.trim();
    if (ticketDept) return ticketDept;
    const orgFull = row.actor?.organization?.descriptor?.trim();
    if (orgFull) {
        const segments = orgFull.split('/').map((s) => s.trim()).filter(Boolean);
        if (segments.length > 0) return segments[segments.length - 1];
        return orgFull;
    }
    return 'Unknown';
}

function trimLabel(label: string, max = 22): string {
    return label.length > max ? `${label.slice(0, max)}…` : label;
}

/** Flattened (user × asset) row for the "Offboarded User Assets" table. */
interface OffboardedAssetRow {
    userId: string;
    lwd: string | null;
    assetTag: string | null;
    serialNumber: string | null;
    modelDisplayName: string | null;
    assetStatus: string | null;
    substatus: string | null;
    assignedDate: string | null;
    stockRoom: string | null;
    location: string | null;
    /** Residual book value at last snapshot — string|number from backend. */
    residualValue: string | number | null;
    /** ISO timestamp the residual_value snapshot was taken. */
    residualDate: string | null;
}

export function OnOffBoardingDashboard() {
    const t = useTranslations('OpsDashboard');
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const deltaLabel = (d: DeltaInfo) =>
        d.trend === 'flat'
            ? t('kpis.momFlat')
            : t('kpis.momDelta', { arrow: d.trend === 'up' ? '▲' : '▼', pct: Math.abs(d.pct) });

    // Default Open-date filter starts at the FIRST DAY OF THE
    // CURRENT MONTH so on/offboarding matches every other Ops
    // dashboard's MTD convention.
    const [defaultFromIso] = useState<string>(() => {
        const d = new Date();
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${yyyy}-${mm}-01`;
    });
    const [now] = useState<number>(() => Date.now());

    // Active tab — persists via localStorage so the page remembers the
    // user's preferred flow across reloads.
    const [flow, setFlowState] = useState<FlowKind>(() => {
        if (typeof window === 'undefined') return 'onboarding';
        try {
            const v = window.localStorage.getItem('ops-dashboard:onoffboarding:flow');
            if (v === 'offboarding' || v === 'onboarding') return v;
        } catch {
            /* ignore */
        }
        return 'onboarding';
    });
    const setFlow = useCallback((next: FlowKind) => {
        setFlowState(next);
        try {
            window.localStorage.setItem('ops-dashboard:onoffboarding:flow', next);
        } catch {
            /* ignore */
        }
    }, []);

    const [filters, setFilters] = useState<FilterState>({
        assigned_group: [],
        state: [],
        created_at_from: { from: defaultFromIso, to: null },
        created_at_to: { from: defaultFromIso, to: null },
        // LWD-between (offboarding) and Onboarding-Date-between
        // (onboarding) both default to "MTD → no upper bound", same
        // convention as the Open-date filter above. Stored under the
        // leading param key per TopFilterBar's date-range contract.
        lwd_from: { from: defaultFromIso, to: null },
        lwd_to: { from: defaultFromIso, to: null },
        hire_date_from: { from: defaultFromIso, to: null },
        hire_date_to: { from: defaultFromIso, to: null },
    });

    // Region / Country / Location are SHARED across every MONITORING
    // dashboard via useOpsGlobalFilter — picking AMER on one page
    // carries the selection to the others so users don't repeat it.
    const {
        filter: globalFilter,
        setRegions: setSelectedRegions,
        setCountries: setSelectedCountries,
        setLocations: setSelectedLocations,
    } = useOpsGlobalFilter();
    const selectedRegions = globalFilter.regions;
    const selectedCountries = globalFilter.countries;
    const selectedLocations = globalFilter.locations;

    const dateRange = (filters.created_at_from as { from: string | null; to: string | null } | undefined) ?? {
        from: null,
        to: null,
    };
    const { data, loading, error, refetch } = useRequests(
        {
            limit: 1000,
            // SN reports timestamps in Asia/Shanghai (+08:00); anchor
            // the user-picked YYYY-MM-DD in that timezone so the API
            // boundaries align with what SN itself shows.
            created_at_from: snDayStartIso(dateRange.from),
            created_at_to: snDayEndIso(dateRange.to),
        },
        { fetchAll: true },
    );
    const partial = data?.partial === true;

    // Hardware fetch — offboarding-only. Drives the "Offboarded User
    // Assets" detail table at the bottom of the page; we join the
    // SN ticket usernames against `assigned_to_username` to surface
    // every asset still on the books for someone whose offboarding
    // ticket is in the current view.
    const { data: hwData, loading: hwLoading } = useHardwares(
        { limit: 1000 },
        { enabled: flow === 'offboarding', fetchAll: true },
    );
    const hardwareRows: HardwareRow[] = hwData?.items ?? [];

    // Worker fetch — onboarding-only. SN-side onboarding tickets don't
    // carry a usable `expected_start_date` (every onboarding row has
    // it null in dev), so we resolve the new hire's onboarding date
    // by joining `ticket.actor_oid` -> `worker.hire_date` from the
    // ABAC-aware `/api/objects/workers` endpoint. ~3k active workers
    // total, fetched once when the user first visits the Onboarding
    // tab, cached client-side via the hook's seen-set dedup.
    const { workers: activeWorkers, loading: workersLoading } = useAllActiveWorkers({
        enabled: flow === 'onboarding',
    });
    const hireDateByOid = useMemo(() => {
        const m = new Map<string, string | null>();
        for (const w of activeWorkers) m.set(w.oid, w.hire_date);
        return m;
    }, [activeWorkers]);

    // Narrow to the active flow using client-side keyword classification.
    // Also apply OIT scope (matches Incidents / Catalog / Aging / Hub
    // / VIP / Unassigned). In practice the flow-keyword filter already
    // catches the OIT queue because "new hire equipment" and the two
    // offboarding templates are OIT-run, but being explicit keeps
    // every ticket dashboard on the same rule.
    const flowRows: TicketRow[] = useMemo(() => {
        const rows = data?.items ?? [];
        return rows.filter((r) => matchesFlow(r, flow) && isInScopeGroup(r.assigned_group));
    }, [data, flow]);

    // Row counts for the tab badges — derived from the ENTIRE fetched
    // window, not the filtered subset, so switching filters doesn't
    // nudge the tab counts and confuse users. Same OIT-scope clamp
    // applied here so the badge never over-counts.
    const allRows = data?.items ?? [];
    const onboardingCount = useMemo(
        () => allRows.filter((r) => matchesFlow(r, 'onboarding') && isInScopeGroup(r.assigned_group)).length,
        [allRows],
    );
    const offboardingCount = useMemo(
        () => allRows.filter((r) => matchesFlow(r, 'offboarding') && isInScopeGroup(r.assigned_group)).length,
        [allRows],
    );

    const slicers: SlicerConfig[] = useMemo(() => {
        const base: SlicerConfig[] = [];
        if (flow === 'offboarding') {
            // LWD slicer is offboarding-only — extracted from the
            // "Offboarding: ... on YYYY-MM-DD for <user>" SN title.
            // Date-range with two pickers so users can scope to an
            // LWD window (e.g. "this week", "next month").
            base.push({
                type: 'date-range',
                param: ['lwd_from', 'lwd_to'],
                label: t('filters.lastWorkingDayBetween'),
                clientSide: true,
            });
        }
        if (flow === 'onboarding') {
            // Onboarding-date slicer — pulled off worker.hire_date via
            // the actor_oid join (see hireDateByOid above). Same
            // semantics as the offboarding LWD-between filter: rows
            // whose new-hire has a hire_date inside [from, to] are kept.
            base.push({
                type: 'date-range',
                param: ['hire_date_from', 'hire_date_to'],
                label: t('filters.onboardingDateBetween'),
                clientSide: true,
            });
        }
        return base;
    }, [t, flow]);

    const filtered = useMemo(() => {
        const groupSel = (filters.assigned_group as string[]) ?? [];
        const stateSel = (filters.state as string[]) ?? [];
        // LWD range — offboarding-only. Stored under the leading
        // param key (`lwd_from`) as a DateRangeValue { from, to }.
        const lwdRange = (filters.lwd_from as { from: string | null; to: string | null } | undefined) ?? {
            from: null,
            to: null,
        };
        // Onboarding-date range — onboarding-only. Stored under the
        // leading param key (`hire_date_from`) for the same reason.
        const hireRange = (filters.hire_date_from as { from: string | null; to: string | null } | undefined) ?? {
            from: null,
            to: null,
        };
        return flowRows.filter((r) => {
            // Region/Country/Location filter is now hidden on both
            // tabs — neither flow has reliable geo signal:
            //   - offboarding caller is the Workday automation account
            //     (no real location), and the offboarded user's worker
            //     row has been HR-cleared by the time the ticket fires.
            //   - onboarding actor is the new hire, but their worker
            //     row sometimes pre-dates location assignment, so the
            //     filter strips half the cohort.
            // Skip the predicate entirely on both flows — the new
            // date-range slicers (LWD-between for offboarding,
            // Onboarding-date-between for onboarding) carry the
            // user-intent better.
            if (groupSel.length && !groupSel.includes(r.assigned_group ?? 'Unknown')) return false;
            if (stateSel.length && !stateSel.includes(r.state)) return false;
            // LWD between — offboarding-only. Keep rows whose parsed
            // LWD falls within [from, to] (inclusive). Rows without
            // a parseable LWD in the title are dropped while either
            // bound is active.
            if (flow === 'offboarding' && (lwdRange.from || lwdRange.to)) {
                const lwd = extractLwdIso(r.title);
                if (!lwd) return false;
                if (lwdRange.from && lwd < lwdRange.from) return false;
                if (lwdRange.to && lwd > lwdRange.to) return false;
            }
            // Onboarding date between — onboarding-only. Keep rows
            // whose actor's hire_date falls within [from, to]
            // (inclusive). Rows whose actor isn't in the workers
            // map (e.g. the worker fetch hasn't returned yet, or
            // the worker is inactive) are dropped while either bound
            // is active.
            if (flow === 'onboarding' && (hireRange.from || hireRange.to)) {
                const oid = r.actor_oid;
                const iso = oid ? hireDateByOid.get(oid) : null;
                if (!iso) return false;
                const hireDay = iso.slice(0, 10); // YYYY-MM-DD prefix is enough for date compare
                if (hireRange.from && hireDay < hireRange.from) return false;
                if (hireRange.to && hireDay > hireRange.to) return false;
            }
            return true;
        });
    }, [flowRows, filters, flow, hireDateByOid]);

    const activeRows = useMemo(() => filtered.filter((r) => isActiveState(r.state)), [filtered]);

    /**
     * Offboarded user × asset join — offboarding-only. We:
     *   1. Walk `filtered` (the in-view offboarding tickets), pulling
     *      the (username, lwd) pair off each title via the SN regex.
     *   2. Bucket them by lowercased username, keeping the *latest*
     *      LWD when the same user appears in multiple tickets
     *      (Retrieve-IT + Revoke-Software fire as a pair).
     *   3. For each (user, lwd), look up matching `hardwareRows`
     *      using a case-insensitive `assigned_to_username` equality.
     *      Users with zero hardware matches are still listed (with
     *      empty asset cells) so ops sees who they couldn't trace —
     *      mirrors the audit need: "everyone leaving + what they
     *      still hold".
     *   4. Flat-emit one row per (user, asset). If a user has zero
     *      hardware hits, we emit a single placeholder row.
     */
    const offboardedAssets = useMemo<OffboardedAssetRow[]>(() => {
        if (flow !== 'offboarding') return [];
        // (1)+(2): collect (user, lwd) pairs.
        const userToLwd = new Map<string, string | null>();
        for (const r of filtered) {
            const user = extractOffboardingUser(r.title);
            if (!user) continue;
            const lwd = extractLwdIso(r.title);
            const prior = userToLwd.get(user);
            // Keep the latest LWD if both are present; otherwise keep
            // whichever we have.
            if (prior === undefined || (lwd && (!prior || lwd > prior))) {
                userToLwd.set(user, lwd ?? prior ?? null);
            }
        }
        if (userToLwd.size === 0) return [];

        // (3)+(4): join against hardware. Build a username → rows map
        // first so we don't do an O(n*m) scan per user.
        const hwByUser = new Map<string, HardwareRow[]>();
        for (const hw of hardwareRows) {
            const u = (hw.assigned_to_username ?? '').toLowerCase().trim();
            if (!u) continue;
            const arr = hwByUser.get(u);
            if (arr) arr.push(hw);
            else hwByUser.set(u, [hw]);
        }

        const out: OffboardedAssetRow[] = [];
        for (const [user, lwd] of userToLwd) {
            const matches = hwByUser.get(user) ?? [];
            if (matches.length === 0) {
                out.push({
                    userId: user,
                    lwd,
                    assetTag: null,
                    serialNumber: null,
                    modelDisplayName: null,
                    assetStatus: null,
                    substatus: null,
                    assignedDate: null,
                    stockRoom: null,
                    location: null,
                    residualValue: null,
                    residualDate: null,
                });
                continue;
            }
            for (const hw of matches) {
                out.push({
                    userId: user,
                    lwd,
                    assetTag: hw.asset_tag,
                    serialNumber: hw.serial_number,
                    modelDisplayName: hw.model_display_name,
                    assetStatus: hw.asset_status,
                    substatus: hw.substatus,
                    assignedDate: hw.assigned_date,
                    stockRoom: hw.stock_room,
                    location: hw.location,
                    residualValue: hw.residual_value,
                    residualDate: hw.residual_date,
                });
            }
        }
        // Order: users with assets first (most actionable), then by
        // LWD ascending (soonest leaving first), then by user id.
        out.sort((a, b) => {
            const aHas = a.assetTag || a.serialNumber ? 0 : 1;
            const bHas = b.assetTag || b.serialNumber ? 0 : 1;
            if (aHas !== bHas) return aHas - bHas;
            const aLwd = a.lwd ?? '\uffff';
            const bLwd = b.lwd ?? '\uffff';
            if (aLwd !== bLwd) return aLwd.localeCompare(bLwd);
            return a.userId.localeCompare(b.userId);
        });
        return out;
    }, [flow, filtered, hardwareRows]);

    /** Distinct user count + matched count for the table subtitle. */
    const offboardedAssetsStats = useMemo(() => {
        const users = new Set<string>();
        const usersWithAsset = new Set<string>();
        let assetCount = 0;
        for (const r of offboardedAssets) {
            users.add(r.userId);
            if (r.assetTag || r.serialNumber) {
                usersWithAsset.add(r.userId);
                assetCount += 1;
            }
        }
        return { users: users.size, usersWithAsset: usersWithAsset.size, assetCount };
    }, [offboardedAssets]);

    const totalMoM = useMemo(() => formatMoM(momByDate(filtered, (r) => openedAt(r), now)), [filtered, now]);
    const activeMoM = useMemo(() => formatMoM(momActiveSnapshot(filtered, now)), [filtered, now]);

    const kpis = useMemo(() => {
        const total = filtered.length;
        const active = activeRows.length;
        const resolved = total - active;
        const resolvedRate = total > 0 ? `${((resolved / total) * 100).toFixed(1)}%` : '—';
        let aging7d = 0;
        let aging30d = 0;
        for (const r of activeRows) {
            const days = daysSinceUpdated(r, now);
            if (days > 7) aging7d += 1;
            if (days > 30) aging30d += 1;
        }
        // Distinct employee count — one employee can have multiple
        // onboarding / offboarding tickets (e.g. "Provision" + "Check
        // Inventory" + "Ship" all reference the same New Hire).
        // Extracting the trailing "for {name|id}" token and dedup'ing
        // gives the actual headcount the page header implies.
        const employeeSet = new Set<string>();
        for (const r of filtered) {
            const key = extractEmployeeKey(r.title);
            if (key) employeeSet.add(key);
        }
        const totalEmployees = employeeSet.size;
        return { total, totalEmployees, active, resolved, resolvedRate, aging7d, aging30d };
    }, [filtered, activeRows, now]);

    const stateDonut = useMemo(
        () => groupBy(filtered, (r) => r.state).map((g) => ({ name: g.key, value: g.count })),
        [filtered],
    );
    // By Group / By Department both run over `filtered` (not just
    // active rows) so closed onboarding/offboarding tickets still
    // surface in the breakdown — these flows finish quickly so the
    // active subset is often empty even when the page has hundreds of
    // resolved rows worth showing.
    const groupDonut = useMemo(() => {
        const ranked = groupBy(filtered, (r) => r.assigned_group).slice(0, 8);
        return ranked.map((g) => ({ name: g.key, value: g.count }));
    }, [filtered]);
    const departmentBar = useMemo(() => {
        const ranked = groupBy(filtered, departmentOf).slice(0, 10);
        return ranked.map((g) => ({ key: trimLabel(g.key), count: g.count }));
    }, [filtered]);

    const trendMonths = useMemo(
        () => monthsFromRange(dateRange.from, dateRange.to, now),
        [dateRange.from, dateRange.to, now],
    );
    const trend = useMemo(
        () =>
            cumulativeTrendByMonth(
                filtered,
                (r) => r.source_closed_at ?? (!isActiveState(r.state) ? (r.source_updated_at ?? r.updated_at) : null),
                trendMonths,
                now,
            ),
        [filtered, trendMonths, now],
    );

    const onGroupSliceClick = useCallback(
        (slice: { name: string }) => {
            const cur = (filters.assigned_group as string[]) ?? [];
            const next = cur.includes(slice.name) ? cur.filter((x) => x !== slice.name) : [...cur, slice.name];
            setFilters({ ...filters, assigned_group: next });
        },
        [filters],
    );
    const onGroupLegendToggle = useCallback((name: string) => onGroupSliceClick({ name }), [onGroupSliceClick]);
    const onStateSliceClick = useCallback(
        (slice: { name: string }) => {
            const cur = (filters.state as string[]) ?? [];
            const next = cur.includes(slice.name) ? cur.filter((x) => x !== slice.name) : [...cur, slice.name];
            setFilters({ ...filters, state: next });
        },
        [filters],
    );
    const onStateLegendToggle = useCallback((name: string) => onStateSliceClick({ name }), [onStateSliceClick]);
    const selectedAssignedGroups = (filters.assigned_group as string[]) ?? [];
    const selectedStates = (filters.state as string[]) ?? [];

    // Ticket-details table columns (Row 4). Kept deliberately lean —
    // request dumps carry dozens of columns; we surface the eight the
    // operations team triages on.
    const tableColumns: Column<TicketRow>[] = useMemo(
        () => [
            {
                key: 'stable_id',
                label: t('charts.colTicketId'),
                width: 'w-28',
                render: (r) => r.stable_id || '—',
            },
            {
                key: 'item',
                label: t('charts.colItem'),
                // Wide-fixed width + nowrap so the SN short description
                // (e.g. "Offboarding: Retrieve IT Equipment on
                // 2025-09-30 for v_anavya") renders on a single line.
                // Long titles are truncated with a tooltip showing the
                // full text — much easier to scan than the previous
                // wrapped-into-3-lines layout.
                width: 'min-w-[28rem] max-w-[36rem]',
                // Prefer SN's short description (`title`) when present —
                // that's where "Offboarding: Retrieve IT Equipment on
                // 2025-09-30 for v_anavya"-style copy lives. Fall back
                // to the SN "item" classifier ("Submit a Service Request",
                // "Offboarding IT Request Form", …) only when title is
                // empty so the column always carries the most specific
                // signal available.
                render: (r) => {
                    const text = r.title || r.item || r.request_item || '—';
                    return (
                        <span
                            className="block whitespace-nowrap overflow-hidden text-ellipsis"
                            title={text}
                        >
                            {text}
                        </span>
                    );
                },
            },
            {
                key: 'caller_name',
                label: t('charts.colCaller'),
                width: 'w-40',
                render: (r) => r.caller_name ?? r.actor?.fullname ?? '—',
            },
            {
                key: 'location',
                label: t('charts.colLocation'),
                width: 'w-48',
                render: (r) => r.actor?.location?.descriptor ?? r.location ?? '—',
            },
            {
                key: 'state',
                label: t('charts.colState'),
                width: 'w-32',
            },
            {
                key: 'assigned_group',
                label: t('charts.colAssignedGroup'),
                width: 'w-40',
                render: (r) => r.assigned_group || '—',
            },
            {
                key: 'assigned_to_name',
                label: t('charts.colAssignee'),
                width: 'w-40',
                render: (r) => r.assigned_to_name ?? '—',
            },
            {
                key: 'created_at',
                label: t('charts.colOpened'),
                width: 'w-32',
                // Show upstream SN open date (source_created_at) per ops-team
                // contract; falls back to local created_at when missing.
                render: (r) => openedAt(r).slice(0, 10) || '—',
                // Sort on parsed timestamp so newer/older ordering
                // doesn't depend on the truncated YYYY-MM-DD string.
                sortValue: (r) => Date.parse(openedAt(r)) || 0,
            },
            {
                key: 'onboarding_date',
                label: t('charts.colOnboardingDate'),
                width: 'w-32',
                // Onboarding tab only — shows the new hire's worker
                // hire_date (joined via actor_oid). Offboarding rows
                // render "—" since hire_date isn't meaningful for the
                // separation cohort.
                render: (r) => {
                    if (flow !== 'onboarding') return '—';
                    const iso = r.actor_oid ? hireDateByOid.get(r.actor_oid) : null;
                    return iso ? iso.slice(0, 10) : '—';
                },
                sortValue: (r) => {
                    if (flow !== 'onboarding') return 0;
                    const iso = r.actor_oid ? hireDateByOid.get(r.actor_oid) : null;
                    return iso ? Date.parse(iso) : 0;
                },
            },
        ],
        [t, flow, hireDateByOid],
    );

    // "Offboarded User Assets" table columns — only rendered for the
    // Offboarding tab. Order is User → LWD → asset basics, matching
    // the audit narrative "who is leaving, when, and what they hold".
    const offboardedAssetColumns: Column<OffboardedAssetRow>[] = useMemo(
        () => [
            {
                key: 'userId',
                label: t('charts.colUserId'),
                width: 'w-32',
                render: (r) => r.userId || '—',
            },
            {
                key: 'lwd',
                label: t('charts.colLastWorkingDay'),
                width: 'w-32',
                render: (r) => r.lwd ?? '—',
                sortValue: (r) => (r.lwd ? Date.parse(r.lwd) : 0),
            },
            {
                key: 'assetTag',
                label: t('charts.colAssetTag'),
                width: 'w-32',
                render: (r) => r.assetTag ?? '—',
            },
            {
                key: 'serialNumber',
                label: t('charts.colSerial'),
                width: 'w-40',
                render: (r) => r.serialNumber ?? '—',
            },
            {
                key: 'modelDisplayName',
                label: t('charts.colModel'),
                width: 'w-48',
                render: (r) => r.modelDisplayName ?? '—',
            },
            {
                key: 'assetStatus',
                label: t('charts.colAssetStatus'),
                width: 'w-32',
                render: (r) => {
                    const status = r.assetStatus ?? '';
                    const sub = r.substatus ? ` / ${r.substatus}` : '';
                    return status ? `${status}${sub}` : '—';
                },
            },
            {
                key: 'stockRoom',
                label: t('charts.colStockRoom'),
                width: 'w-40',
                render: (r) => r.stockRoom ?? r.location ?? '—',
            },
            {
                key: 'residualValue',
                // Combined cell: book value + the date that snapshot was
                // taken. Both columns are 100% / 81% populated on the
                // dev hardware roster, so this is reliable signal for
                // ops to gauge how much equipment value is still in the
                // wild for each leaver.
                label: t('charts.colResidualValue'),
                width: 'w-40',
                render: (r) => {
                    if (r.residualValue === null || r.residualValue === undefined) return '—';
                    const num = typeof r.residualValue === 'string' ? Number(r.residualValue) : r.residualValue;
                    if (!Number.isFinite(num)) return '—';
                    const formatted = `$${num.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    })}`;
                    const dateLabel = r.residualDate ? r.residualDate.slice(0, 10) : null;
                    return dateLabel ? `${formatted} (${dateLabel})` : formatted;
                },
                sortValue: (r) => {
                    if (r.residualValue === null || r.residualValue === undefined) return -Infinity;
                    const num = typeof r.residualValue === 'string' ? Number(r.residualValue) : r.residualValue;
                    return Number.isFinite(num) ? num : -Infinity;
                },
            },
            {
                key: 'assignedDate',
                label: t('charts.colAssignedDate'),
                width: 'w-32',
                render: (r) => (r.assignedDate ? r.assignedDate.slice(0, 10) : '—'),
                sortValue: (r) => (r.assignedDate ? Date.parse(r.assignedDate) : 0),
            },
        ],
        [t],
    );

    const textMain = isLight ? 'text-slate-800' : 'text-white';
    const textMuted = isLight ? 'text-slate-500' : 'text-gray-400';

    const hasFilters = (Object.entries(filters) as [string, unknown][]).some(([, v]) => {
        if (Array.isArray(v)) return v.length > 0;
        const range = v as { from: string | null; to: string | null } | undefined;
        return !!(range?.from || range?.to);
    });

    const extraActiveFilterCount = useMemo(() => {
        let n = 0;
        const grp = filters.assigned_group;
        if (Array.isArray(grp)) n += grp.length;
        const st = filters.state;
        if (Array.isArray(st)) n += st.length;
        const r = filters.created_at_from as { from: string | null; to: string | null } | undefined;
        if (r && (r.from !== defaultFromIso || r.to !== null)) n += 1;
        // LWD-between and Onboarding-Date-between also count when the
        // user moves them off their MTD default so Clear All lights up.
        const lwd = filters.lwd_from as { from: string | null; to: string | null } | undefined;
        if (lwd && (lwd.from !== defaultFromIso || lwd.to !== null)) n += 1;
        const hire = filters.hire_date_from as { from: string | null; to: string | null } | undefined;
        if (hire && (hire.from !== defaultFromIso || hire.to !== null)) n += 1;
        return n;
    }, [filters, defaultFromIso]);

    function resetAllParentFilters() {
        setFilters({
            assigned_group: [],
            state: [],
            created_at_from: { from: defaultFromIso, to: null },
            created_at_to: { from: defaultFromIso, to: null },
            lwd_from: { from: defaultFromIso, to: null },
            lwd_to: { from: defaultFromIso, to: null },
            hire_date_from: { from: defaultFromIso, to: null },
            hire_date_to: { from: defaultFromIso, to: null },
        });
    }

    const totalActiveFilterCount =
        selectedRegions.length + selectedCountries.length + selectedLocations.length + extraActiveFilterCount;
    const hasAnyActiveFilter = totalActiveFilterCount > 0;
    function clearEveryFilter() {
        setSelectedRegions([]);
        setSelectedCountries([]);
        setSelectedLocations([]);
        resetAllParentFilters();
    }

    const pageTitle = t('pages.onOffBoardingTitle');
    const pageSubtitle =
        flow === 'onboarding' ? t('pages.onboardingSubtitle') : t('pages.offboardingSubtitle');
    const palette = FLOW_META[flow].palette;
    const accent = FLOW_META[flow].accent;
    const HeaderIcon = flow === 'onboarding' ? UserPlus : UserMinus;

    return (
        <div className={`flex flex-col h-[calc(100vh-4rem)] overflow-hidden p-4 gap-3 ${isLight ? 'bg-slate-50' : ''}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            flow === 'onboarding'
                                ? isLight
                                    ? 'bg-emerald-100 text-emerald-600'
                                    : 'bg-emerald-500/20 text-emerald-400'
                                : isLight
                                  ? 'bg-orange-100 text-orange-600'
                                  : 'bg-orange-500/20 text-orange-400'
                        }`}
                    >
                        <HeaderIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className={`text-2xl font-semibold ${textMain}`}>{pageTitle}</h1>
                        <p className={`text-sm mt-0.5 ${textMuted}`}>{pageSubtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {hasFilters && (
                        <span className="text-xs text-blue-400">
                            {t('pages.filteredOnOffBoarding', {
                                filtered: filtered.length.toLocaleString(),
                                total: flowRows.length.toLocaleString(),
                            })}
                        </span>
                    )}
                    <div className="flex items-center gap-2">
                        <TranslatedAutoRefresh onRefresh={() => void refetch()} storageKey="ops-dashboard:on-off-boarding:auto-refresh" />
                        <button
                        onClick={() => void refetch()}
                        className={`p-2 rounded-lg border transition-colors ${
                            isLight
                                ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                : 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10'
                        }`}
                        title={t('empty.retry')}
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    </div>
                </div>
            </div>

            {/* Tab switcher */}
            <div
                className={`flex items-center gap-1 p-1 rounded-lg border shrink-0 w-fit ${
                    isLight ? 'bg-white border-slate-200' : 'bg-white/5 border-white/10'
                }`}
                role="tablist"
            >
                {(['onboarding', 'offboarding'] as const).map((kind) => {
                    const active = flow === kind;
                    const label = kind === 'onboarding' ? t('pages.tabOnboarding') : t('pages.tabOffboarding');
                    const count = kind === 'onboarding' ? onboardingCount : offboardingCount;
                    const Icon = kind === 'onboarding' ? UserPlus : UserMinus;
                    return (
                        <button
                            key={kind}
                            role="tab"
                            aria-selected={active}
                            onClick={() => setFlow(kind)}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                                active
                                    ? isLight
                                        ? 'bg-slate-900 text-white'
                                        : 'bg-white text-slate-900'
                                    : isLight
                                      ? 'text-slate-600 hover:bg-slate-100'
                                      : 'text-gray-300 hover:bg-white/10'
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            <span>{label}</span>
                            <span
                                className={`text-[11px] px-1.5 py-0.5 rounded-full ${
                                    active
                                        ? isLight
                                            ? 'bg-white/20 text-white'
                                            : 'bg-slate-900/20 text-slate-900'
                                        : isLight
                                          ? 'bg-slate-100 text-slate-600'
                                          : 'bg-white/10 text-gray-400'
                                }`}
                            >
                                {count.toLocaleString()}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Filter panel */}
            <TopFilterBar
                slicers={slicers}
                value={filters}
                onChange={setFilters}
                storageKey="ops-dashboard:onoffboarding:filters"
                title={t('filters.title')}
                clearLabel={t('filters.clearAll')}
                clientSideTooltip={t('filters.clientSideTooltip')}
                hideHeaderClear
                headerActions={
                    <button
                        type="button"
                        onClick={hasAnyActiveFilter ? clearEveryFilter : undefined}
                        disabled={!hasAnyActiveFilter}
                        className={`text-xs rounded-lg px-3 py-1 border transition-colors ${
                            hasAnyActiveFilter
                                ? isLight
                                    ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100 cursor-pointer'
                                    : 'bg-red-500/15 border-red-500/40 text-red-300 hover:bg-red-500/25 cursor-pointer'
                                : isLight
                                  ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-white/5 border-white/10 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        {t('filters.clearAllFilters')}
                    </button>
                }
                headerSlot={
                    // Region/Country/Location is hidden on both flows.
                    // - Offboarding: caller is the Workday automation
                    //   account, so r.actor carries no physical
                    //   region/country/location for the offboarded user.
                    // - Onboarding: actor is the new hire, but their
                    //   worker row sometimes pre-dates location
                    //   assignment, so the geo filter strips half the
                    //   cohort. The Onboarding-Date-Between slicer in
                    //   the row below covers the meaningful date
                    //   dimension instead.
                    null
                }
            />

            {/* Scrollable main content */}
            <div className="flex-1 min-h-0 overflow-auto">
                {partial && (
                    <div
                        className={`rounded-xl border p-3 mb-3 text-xs flex items-center gap-2 ${
                            isLight
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        }`}
                    >
                        <span>{t('empty.partialResult')}</span>
                        <button
                            onClick={() => void refetch()}
                            className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${
                                isLight
                                    ? 'bg-amber-100 hover:bg-amber-200 text-amber-800'
                                    : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200'
                            }`}
                        >
                            {t('empty.retry')}
                        </button>
                    </div>
                )}
                {error && !partial && (
                    <div
                        className={`rounded-xl border p-3 mb-3 text-xs flex items-center gap-2 ${
                            isLight
                                ? 'border-red-200 bg-red-50 text-red-700'
                                : 'border-red-500/30 bg-red-500/10 text-red-300'
                        }`}
                    >
                        <span>{error}</span>
                        <button
                            onClick={() => void refetch()}
                            className={`ml-auto px-2 py-0.5 rounded text-[11px] font-medium ${
                                isLight
                                    ? 'bg-red-100 hover:bg-red-200 text-red-800'
                                    : 'bg-red-500/20 hover:bg-red-500/30 text-red-200'
                            }`}
                        >
                            {t('empty.retry')}
                        </button>
                    </div>
                )}

                {/* Row 1a: headline KPIs — total tickets + distinct
                    employees (one employee can have multiple tickets,
                    so the two numbers diverge). */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                    <KpiCard
                        label={
                            flow === 'onboarding'
                                ? t('kpis.totalOnboarding')
                                : t('kpis.totalOffboarding')
                        }
                        tooltip={
                            flow === 'onboarding'
                                ? t('kpis.totalOnboardingInfo')
                                : t('kpis.totalOffboardingInfo')
                        }
                        value={kpis.total}
                        icon={HeaderIcon}
                    />
                    <KpiCard
                        label={
                            flow === 'onboarding'
                                ? t('kpis.totalOnboardingEmployees')
                                : t('kpis.totalOffboardingEmployees')
                        }
                        tooltip={
                            flow === 'onboarding'
                                ? t('kpis.totalOnboardingEmployeesInfo')
                                : t('kpis.totalOffboardingEmployeesInfo')
                        }
                        value={kpis.totalEmployees}
                    />
                    <KpiCard
                        label={t('kpis.active')}
                        tooltip={t('kpis.activeInfo')}
                        value={kpis.active}
                    />
                    <KpiCard label={t('kpis.resolvedRate')} tooltip={t('kpis.resolvedRateInfo')} value={kpis.resolvedRate} />
                </div>

                {/* Row 1b: secondary KPIs — resolved volume + aging tier. */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                    <KpiCard label={t('kpis.resolved')} tooltip={t('kpis.resolvedInfo')} value={kpis.resolved} />
                    <KpiCard label={t('kpis.agingGt7d')} tooltip={t('kpis.agingGt7dInfo')} value={kpis.aging7d} />
                    <KpiCard label={t('kpis.agingGt30d')} tooltip={t('kpis.agingGt30dInfo')} value={kpis.aging30d} />
                </div>

                {/* Row 2: Donuts */}
                <div className="grid gap-3 mb-3 grid-cols-2">
                    <DonutCard
                        title={t('charts.byStateAll')}
                        info={t('charts.byStateAllInfo')}
                        data={stateDonut}
                        palette={palette}
                        height={220}
                        onSliceClick={onStateSliceClick}
                        selectedSlices={selectedStates}
                        onLegendToggle={onStateLegendToggle}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <DonutCard
                        title={
                            flow === 'onboarding'
                                ? t('charts.activeByGroupOnboarding')
                                : t('charts.activeByGroupOffboarding')
                        }
                        subtitle={t('charts.activeByGroupSubtitle')}
                        info={
                            flow === 'onboarding'
                                ? t('charts.activeByGroupOnboardingInfo')
                                : t('charts.activeByGroupOffboardingInfo')
                        }
                        data={groupDonut}
                        palette={palette}
                        height={220}
                        onSliceClick={onGroupSliceClick}
                        selectedSlices={selectedAssignedGroups}
                        onLegendToggle={onGroupLegendToggle}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>

                {/* Row 3: Department bar + trend */}
                <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: '3fr 2fr' }}>
                    <GroupBarCard
                        title={t('charts.byDepartment')}
                        info={t('charts.byDepartmentInfo')}
                        data={departmentBar}
                        topN={10}
                        height={260}
                        // Multi-hue rank palette so the 10 bars stay
                        // visually distinct (was a single-colour wash).
                        color={SHARED_FLOW_PALETTE}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                    <TrendLineCard
                        title={t('charts.volumeTrend')}
                        subtitle={t('charts.cumulativeOpenedClosed')}
                        info={t('charts.volumeTrendInfo')}
                        data={trend}
                        height={260}
                        series={[
                            // Per-flow accent colour so onboarding =
                            // green / offboarding = amber for opened,
                            // and a contrasting blue for closed so the
                            // two lines never blur together.
                            { key: 'opened', label: 'Opened (cumulative)', color: accent },
                            { key: 'closed', label: 'Closed (cumulative)', color: '#3b82f6' },
                        ]}
                        emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    />
                </div>

                {/* Row 4: Ticket details table — collapsible. Heavy on
                    DOM (up to 500 rows) so we keep it folded by default
                    and persist the user's choice per page. */}
                <OnOffBoardingDetailSection
                    isLight={isLight}
                    title={t('charts.ticketDetails')}
                    subtitle={t('charts.ticketDetailsSubtitle', {
                        shown: Math.min(filtered.length, 500).toLocaleString(),
                        total: filtered.length.toLocaleString(),
                    })}
                    info={t('charts.ticketDetailsInfo')}
                    rows={filtered}
                    columns={tableColumns}
                    csvFilename={`onoffboarding_${flow}`}
                    emptyText={loading ? t('empty.loading') : t('empty.noData')}
                    storageKey={`ops-dashboard:on-off-boarding:${flow}:detail-open`}
                />

                {/* Row 5: Offboarded User Assets — offboarding-only.
                    Joins SN ticket usernames against `assigned_to_username`
                    on the hardware roster. Coverage is best-effort: vendor
                    accounts (v_*) and shortened user IDs (e.g. `antonio`
                    vs `antoniobjr`) often miss; we still list the user
                    with empty asset cells so ops sees who they couldn't
                    trace. */}
                {flow === 'offboarding' && (
                    <OnOffBoardingDetailSection<OffboardedAssetRow>
                        isLight={isLight}
                        title={t('charts.offboardedAssets')}
                        subtitle={t('charts.offboardedAssetsSubtitle', {
                            users: offboardedAssetsStats.users.toLocaleString(),
                            withAsset: offboardedAssetsStats.usersWithAsset.toLocaleString(),
                            assets: offboardedAssetsStats.assetCount.toLocaleString(),
                        })}
                        info={t('charts.offboardedAssetsInfo')}
                        rows={offboardedAssets}
                        columns={offboardedAssetColumns}
                        csvFilename="offboarded_user_assets"
                        emptyText={
                            hwLoading || loading ? t('empty.loading') : t('empty.noData')
                        }
                        storageKey="ops-dashboard:on-off-boarding:offboarded-assets:detail-open"
                    />
                )}
            </div>
        </div>
    );
}

interface OnOffBoardingDetailSectionProps<R> {
    isLight: boolean;
    title: string;
    subtitle: string;
    info: string;
    rows: R[];
    columns: Column<R>[];
    csvFilename: string;
    emptyText: string;
    storageKey: string;
}

function OnOffBoardingDetailSection<R>({
    isLight,
    title,
    subtitle,
    info,
    rows,
    columns,
    csvFilename,
    emptyText,
    storageKey,
}: OnOffBoardingDetailSectionProps<R>) {
    const [open, setOpen] = useState<boolean>(() => {
        if (typeof window === 'undefined') return false;
        try {
            return window.localStorage.getItem(storageKey) === '1';
        } catch {
            return false;
        }
    });

    const titleCls = isLight ? 'text-slate-800' : 'text-white';
    const mutedCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const cardCls = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5';

    return (
        <details
            className={`mb-3 rounded-xl border ${cardCls}`}
            open={open}
            onToggle={(e) => {
                const next = (e.currentTarget as HTMLDetailsElement).open;
                setOpen(next);
                try {
                    window.localStorage.setItem(storageKey, next ? '1' : '0');
                } catch {
                    /* ignore */
                }
            }}
        >
            <summary
                className={`list-none cursor-pointer select-none px-4 py-3 flex items-center justify-between ${titleCls}`}
            >
                <span className="flex items-center gap-2 text-sm font-medium">
                    <ChevronDown
                        className={`w-4 h-4 transition-transform ${open ? 'rotate-0' : '-rotate-90'}`}
                    />
                    <span>{title}</span>
                    <span
                        className={`text-xs font-normal ${mutedCls}`}
                        title={info}
                    >
                        — {subtitle}
                    </span>
                </span>
            </summary>
            {open && (
                <div className="px-4 pb-4">
                    <DataTableCard
                        rows={rows}
                        columns={columns}
                        maxRows={500}
                        emptyText={emptyText}
                        csvFilename={csvFilename}
                    />
                </div>
            )}
        </details>
    );
}
