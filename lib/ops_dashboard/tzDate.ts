/**
 * Timezone-aware date helpers for the ticket dashboards.
 *
 * Every ticket-facing dashboard (Incidents, Catalog, On/Offboarding,
 * Hub, Aging, Unassigned, VIP) anchors "Open Date" — both for server
 * filtering AND for table / chart rendering — in
 * **America/Los_Angeles**.
 *
 * The browser's default `new Date(iso).toLocaleDateString()` and
 * `iso.slice(0, 10)` behaviours are locale / UTC dependent and
 * therefore wrong for ops-dashboard purposes (the ops team reads SN
 * UI in LA local time and expects the dashboard to match).
 *
 * Use these helpers everywhere a ticket's `source_created_at` is
 * formatted, sorted by day, or bucketed by month.
 */
import { TICKET_TIMEZONE, openedAt } from './aggregate';

/**
 * Internal: extract `{ year, month, day, hour, minute, second }` for
 * an ISO timestamp under the LA timezone, regardless of where the
 * browser is running. Built on `Intl.DateTimeFormat` so it tracks DST
 * automatically.
 */
function laParts(iso: string): {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
} | null {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return null;
    const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: TICKET_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
    const out = { year: '', month: '', day: '', hour: '', minute: '', second: '' };
    for (const part of fmt.formatToParts(new Date(t))) {
        if (part.type in out) {
            (out as Record<string, string>)[part.type] = part.value;
        }
    }
    return out;
}

/**
 * `'2026-05-01'` — LA-day key. Use for `Map<dayKey, ...>` / sorted
 * by-day strings / day-level comparisons.
 *
 * Returns null for missing / unparseable input so callers can chain
 * with optional rendering.
 */
export function laDayKey(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const p = laParts(iso);
    return p ? `${p.year}-${p.month}-${p.day}` : null;
}

/**
 * `'2026-05-01'` — LA month-start key. Use for monthly trend buckets.
 */
export function laMonthKey(iso: string | null | undefined): string | null {
    if (!iso) return null;
    const p = laParts(iso);
    return p ? `${p.year}-${p.month}-01` : null;
}

/**
 * `'5/1/2026'` — table-cell label, LA-anchored. Replaces
 * `new Date(iso).toLocaleDateString()` which uses the browser's tz.
 *
 * Returns `'—'` (em dash) for missing / unparseable input so it slots
 * straight into table cells.
 */
export function laDateLabel(iso: string | null | undefined): string {
    if (!iso) return '—';
    const p = laParts(iso);
    if (!p) return '—';
    // M/D/YYYY (drop the leading zeros to match the existing
    // `toLocaleDateString('en-US')` output the ops team is used to).
    const m = String(parseInt(p.month, 10));
    const d = String(parseInt(p.day, 10));
    return `${m}/${d}/${p.year}`;
}

/**
 * `'5/1/2026, 3:44:09 AM'` — full LA timestamp for hover tooltips
 * and detail panels. AM/PM included.
 */
export function laDateTimeLabel(iso: string | null | undefined): string {
    if (!iso) return '—';
    const p = laParts(iso);
    if (!p) return '—';
    const m = String(parseInt(p.month, 10));
    const d = String(parseInt(p.day, 10));
    const hh = parseInt(p.hour, 10);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const hh12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${m}/${d}/${p.year}, ${hh12}:${p.minute}:${p.second} ${ampm}`;
}

/**
 * Convenience: pull a row's LA-anchored "opened" day. Combines
 * `openedAt(row)` (= `source_created_at` with `created_at` fallback)
 * with {@link laDayKey}.
 */
export function rowLaOpenedDay(row: {
    source_created_at?: string | null;
    created_at?: string | null;
}): string | null {
    return laDayKey(openedAt(row));
}
