/**
 * Region helpers — bucket a country / location string into one of
 * three geographic regions: **AMER, EMEA, APAC**.
 *
 * The Ops Dashboard region filter is geographic (where the user is),
 * **not** organisational (which support team picked it up). That makes
 * Region and Country two views of the same dimension instead of two
 * independent ones — selecting AMER must show only AMER countries, and
 * the per-region counts must reflect tickets whose caller location
 * lives in that region.
 *
 * Location strings in the data look like:
 *   - "US-California-Los Angeles", "Canada-Ontario", "Brazil-Remote"
 *   - "United Kingdom", "France-Remote", "Germany-Munich"
 *   - "China-Shanghai", "Japan-Tokyo-Business Tower", "Singapore"
 *   - "Unknown", "Global", "Americas", "EMEA", "APAC"
 *
 * Country detection works on the leading token (split on "-") plus a
 * curated set of multi-word country names; rows whose location does
 * not match any AMER / EMEA / APAC entry (e.g. "Unknown", "Global",
 * `null`) yield `null` and are dropped from region counts and from
 * any region's country list.
 */

import type { Region } from '@/components/ops_dashboard/RegionMap';

/**
 * Active region buckets surfaced in the filter UI. The wider Region
 * type from `RegionMap` includes "OTHER" for the world-map widget; we
 * intentionally exclude it here so the filter UI never shows it.
 */
export const REGIONS: readonly Region[] = ['AMER', 'EMEA', 'APAC'] as const;

/**
 * Multi-word / canonical country names mapped to their region. Order
 * matters only for documentation; lookup is by exact case-insensitive
 * match against the leading token of the location string.
 *
 * If you add a country, prefer the form that appears in the data
 * (see `hierarchies.locations.name` distincts).
 */
const COUNTRY_TO_REGION: Record<string, Region> = {
    // ---- AMER ----
    'us': 'AMER',
    'usa': 'AMER',
    'united states': 'AMER',
    'united states of america': 'AMER',
    'canada': 'AMER',
    'mexico': 'AMER',
    'brazil': 'AMER',
    'argentina': 'AMER',
    'chile': 'AMER',
    'colombia': 'AMER',
    'peru': 'AMER',
    'americas': 'AMER',
    'amer': 'AMER',

    // ---- EMEA ----
    'united kingdom': 'EMEA',
    'uk': 'EMEA',
    'great britain': 'EMEA',
    'ireland': 'EMEA',
    'france': 'EMEA',
    'germany': 'EMEA',
    'italy': 'EMEA',
    'spain': 'EMEA',
    'portugal': 'EMEA',
    'netherlands': 'EMEA',
    'belgium': 'EMEA',
    'luxembourg': 'EMEA',
    'switzerland': 'EMEA',
    'austria': 'EMEA',
    'denmark': 'EMEA',
    'finland': 'EMEA',
    'norway': 'EMEA',
    'sweden': 'EMEA',
    'iceland': 'EMEA',
    'poland': 'EMEA',
    'czech republic': 'EMEA',
    'slovakia': 'EMEA',
    'hungary': 'EMEA',
    'romania': 'EMEA',
    'bulgaria': 'EMEA',
    'greece': 'EMEA',
    'croatia': 'EMEA',
    'serbia': 'EMEA',
    'slovenia': 'EMEA',
    'türkiye': 'EMEA',
    'turkey': 'EMEA',
    'russia': 'EMEA',
    'russian federation': 'EMEA',
    'ukraine': 'EMEA',
    'belarus': 'EMEA',
    'kazakhstan': 'EMEA',
    'uzbekistan': 'EMEA',
    'azerbaijan': 'EMEA',
    'georgia': 'EMEA',
    'israel': 'EMEA',
    'saudi arabia': 'EMEA',
    'uae': 'EMEA',
    'united arab emirates': 'EMEA',
    'qatar': 'EMEA',
    'kuwait': 'EMEA',
    'bahrain': 'EMEA',
    'oman': 'EMEA',
    'jordan': 'EMEA',
    'lebanon': 'EMEA',
    'egypt': 'EMEA',
    'morocco': 'EMEA',
    'algeria': 'EMEA',
    'tunisia': 'EMEA',
    'south africa': 'EMEA',
    'nigeria': 'EMEA',
    'kenya': 'EMEA',
    'emea': 'EMEA',

    // ---- APAC ----
    'china': 'APAC',
    'hong kong': 'APAC',
    'macau': 'APAC',
    'taiwan': 'APAC',
    'japan': 'APAC',
    'korea': 'APAC',
    's.korea': 'APAC',
    'south korea': 'APAC',
    'korea, republic of': 'APAC',
    'india': 'APAC',
    'pakistan': 'APAC',
    'bangladesh': 'APAC',
    'sri lanka': 'APAC',
    'nepal': 'APAC',
    'myanmar': 'APAC',
    'thailand': 'APAC',
    'vietnam': 'APAC',
    'viet nam': 'APAC',
    'cambodia': 'APAC',
    'laos': 'APAC',
    'malaysia': 'APAC',
    'singapore': 'APAC',
    'indonesia': 'APAC',
    'philippines': 'APAC',
    'brunei': 'APAC',
    'mongolia': 'APAC',
    'australia': 'APAC',
    'new zealand': 'APAC',
    'fiji': 'APAC',
    'papua new guinea': 'APAC',
    'apac': 'APAC',
};

/**
 * Pull the leading country token out of a location string. Examples:
 *   "US-California-Los Angeles" → "us"
 *   "Korea, Republic of"        → "korea, republic of"
 *   "  Hong Kong  "             → "hong kong"
 *   "United Kingdom"            → "united kingdom"
 *   "Singapore TWP Office"      → "singapore"   (stock-room style)
 *   "Italy-Remote"              → "italy"
 */
function leadingCountryToken(location: string): string {
    const trimmed = location.trim().toLowerCase();
    if (!trimmed) return '';
    // 1. Whole-string match handles multi-word country names like
    //    "Hong Kong" and "Korea, Republic of".
    if (trimmed in COUNTRY_TO_REGION) return trimmed;
    // 2. Dash-first match for the canonical "Country-Region-City"
    //    layout used by the location column.
    const dashHead = trimmed.split('-', 1)[0]?.trim() ?? '';
    if (dashHead && dashHead in COUNTRY_TO_REGION) return dashHead;
    // 3. Fall back to splitting on any separator (whitespace / dash /
    //    comma) — catches stock-room labels like "Singapore TWP
    //    Office" where the country is just the leading word.
    const head = trimmed.split(/[\s\-,]+/, 1)[0]?.trim() ?? '';
    return head;
}

/**
 * Map a country / location string to its Region, or `null` when the
 * country isn't classified into AMER / EMEA / APAC ("Unknown",
 * "Global", or anything else not in the curated list above).
 */
export function countryToRegion(location: string | null | undefined): Region | null {
    if (!location) return null;
    const head = leadingCountryToken(location);
    if (!head) return null;
    return COUNTRY_TO_REGION[head] ?? null;
}

/**
 * Normalise a region-like token to the canonical Region enum.
 * Handles every flavour of region label seen in the data:
 *   - Uppercase canonical: "AMER" / "EMEA" / "APAC"
 *   - Lowercase: "amer" / "emea" / "apac"
 *   - Internal spelling: "eurp" → EMEA, "americas" → AMER
 *   - Region codes with suffix: "APAC 2" / "AMER-1" → APAC / AMER
 *
 * Returns `null` when the value doesn't resolve, so callers can
 * chain fallbacks via `??`.
 */
export function normalizeRegion(value: string | null | undefined): Region | null {
    if (!value) return null;
    const t = value.trim().toUpperCase();
    if (!t) return null;
    // Pluck the leading alpha-only segment (handles "APAC 2" /
    // "AMER-1" / "EMEA, EU"). Split on any non-letter character.
    const head = t.split(/[^A-Z]+/, 1)[0];
    if (!head) return null;
    if (head === 'AMER' || head === 'AMERICAS') return 'AMER';
    if (head === 'EMEA' || head === 'EUROPE' || head === 'EURP' || head === 'EU') return 'EMEA';
    if (head === 'APAC' || head === 'ASIA') return 'APAC';
    return null;
}

/**
 * Extract just the leading country token from a location string,
 * preserving the original casing. Examples:
 *   "US-California-Palo Alto"   → "US"
 *   "Singapore-CapitaSky"       → "Singapore"
 *   "S.Korea-Seoul"             → "S.Korea"
 *   "Hong Kong"                 → "Hong Kong"   (no dash, whole string)
 *   "Korea, Republic of"        → "Korea, Republic of"
 *
 * Used by the Country / Location filter UI to bucket fine-grained
 * locations (with cities / sites) up to a single country label.
 */
export function extractCountry(location: string | null | undefined): string | null {
    if (!location) return null;
    const t = location.trim();
    if (!t) return null;
    const dashIdx = t.indexOf('-');
    return dashIdx === -1 ? t : t.slice(0, dashIdx).trim();
}

/**
 * Canonical country aliases — the source data uses several spellings
 * for the same country ("US" / "United States" / "United States of
 * America"; "UK" / "Great Britain"; "S.Korea" / "Korea, Republic of";
 * etc). Lookup is by lowercase exact match against the trimmed input.
 *
 * Anything not in this map falls through to the original string, so
 * adding new variants is the only maintenance burden.
 */
const CANONICAL_COUNTRY: Record<string, string> = {
    // United States
    'us': 'United States',
    'usa': 'United States',
    'united states': 'United States',
    'united states of america': 'United States',
    // United Kingdom
    'uk': 'United Kingdom',
    'great britain': 'United Kingdom',
    'united kingdom': 'United Kingdom',
    // South Korea
    's.korea': 'South Korea',
    'south korea': 'South Korea',
    'korea': 'South Korea',
    'korea, republic of': 'South Korea',
    // Vietnam (data has both spellings)
    'viet nam': 'Vietnam',
    'vietnam': 'Vietnam',
    // Türkiye / Turkey
    'türkiye': 'Türkiye',
    'turkey': 'Türkiye',
    // UAE
    'uae': 'United Arab Emirates',
    'united arab emirates': 'United Arab Emirates',
    // Russia
    'russia': 'Russia',
    'russian federation': 'Russia',
};

/**
 * Map a country name to its canonical display form. Idempotent — a
 * country that's already canonical (or absent from the alias map)
 * comes back unchanged.
 */
export function canonicalizeCountry(country: string | null | undefined): string {
    if (!country) return '';
    const trimmed = country.trim();
    if (!trimmed) return '';
    return CANONICAL_COUNTRY[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Extract the second segment of a location string — typically the
 * city, state, or regional area. Used as the sub-grouping label in
 * the Location dropdown so sites cluster under e.g. "California" or
 * "Tokyo".
 *
 *   "US-California-Palo Alto"    → "California"
 *   "Japan-Tokyo-Mori Tower"     → "Tokyo"
 *   "Singapore-CapitaSky"        → "CapitaSky"
 *   "Hong Kong"                  → ""   (no second segment)
 *
 * Returns empty string when the location has fewer than two segments.
 * Callers that want a sensible fallback can pipe through `|| country`.
 */
export function extractCity(location: string | null | undefined): string {
    if (!location) return '';
    const parts = location.trim().split('-').map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) return '';
    return parts[1];
}

/**
 * Count rows per region, deriving region from each row's location
 * string. Rows whose country can't be classified are excluded.
 */
export function countByRegion<T>(
    rows: T[],
    getLocation: (row: T) => string | null | undefined,
): Record<Region, number> {
    const counts: Record<Region, number> = { AMER: 0, EMEA: 0, APAC: 0, OTHER: 0 };
    for (const row of rows) {
        const r = countryToRegion(getLocation(row));
        if (r) counts[r] += 1;
    }
    return counts;
}

/**
 * Build a Region → sorted-unique country list from rows. Countries
 * are returned in their **canonical** form (e.g. "US",
 * "United States", and "United States of America" all collapse to
 * "United States"). Rows whose country can't be classified are
 * dropped — no OTHER bucket.
 */
export function regionToCountries<T>(
    rows: T[],
    getLocation: (row: T) => string | null | undefined,
): Record<Region, string[]> {
    const buckets: Record<Region, Set<string>> = {
        AMER: new Set(),
        EMEA: new Set(),
        APAC: new Set(),
        OTHER: new Set(),
    };
    for (const row of rows) {
        const location = getLocation(row)?.trim();
        if (!location) continue;
        const rawCountry = extractCountry(location);
        if (!rawCountry) continue;
        const r = countryToRegion(rawCountry);
        if (!r) continue;
        buckets[r].add(canonicalizeCountry(rawCountry));
    }
    return {
        AMER: [...buckets.AMER].sort(),
        EMEA: [...buckets.EMEA].sort(),
        APAC: [...buckets.APAC].sort(),
        OTHER: [...buckets.OTHER].sort(),
    };
}

/**
 * Build a Country → sorted-unique full-location list. Country keys
 * are canonical (US / United States / USA all collapse). Used by the
 * Location filter dropdown so fine-grained sites cluster under their
 * country header.
 */
export function countryToLocations<T>(
    rows: T[],
    getLocation: (row: T) => string | null | undefined,
): Record<string, string[]> {
    const buckets = new Map<string, Set<string>>();
    for (const row of rows) {
        const location = getLocation(row)?.trim();
        if (!location) continue;
        const rawCountry = extractCountry(location);
        if (!rawCountry) continue;
        // Skip locations whose country isn't classifiable — these
        // would otherwise show up under a confusing "Unknown" group.
        if (!countryToRegion(rawCountry)) continue;
        const canonical = canonicalizeCountry(rawCountry);
        if (!buckets.has(canonical)) buckets.set(canonical, new Set());
        buckets.get(canonical)!.add(location);
    }
    const out: Record<string, string[]> = {};
    for (const [country, locs] of buckets) {
        out[country] = [...locs].sort();
    }
    return out;
}

/**
 * Predicate: does `row` pass the active Region / Country / Location
 * selection? Empty selection on a dimension = no filter on that
 * dimension. The three are AND-combined.
 *
 * Country comparison uses the canonical form so a selection of
 * "United States" matches rows with raw country "US",
 * "United States", or "United States of America".
 */
export function matchesRegionCountry<T>(
    row: T,
    selectedRegions: Region[],
    selectedCountries: string[],
    selectedLocations: string[],
    getLocation: (row: T) => string | null | undefined,
): boolean {
    const location = getLocation(row)?.trim() ?? '';
    if (selectedLocations.length > 0) {
        if (!selectedLocations.includes(location)) return false;
    }
    const rawCountry = extractCountry(location) ?? '';
    if (selectedCountries.length > 0) {
        const canonical = canonicalizeCountry(rawCountry);
        if (!selectedCountries.includes(canonical)) return false;
    }
    if (selectedRegions.length > 0) {
        const r = countryToRegion(rawCountry);
        if (!r || !selectedRegions.includes(r)) return false;
    }
    return true;
}
