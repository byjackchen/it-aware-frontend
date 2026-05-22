/**
 * Helpers for the "default + override" service-catalog / service-type field
 * pair used across activities (interactions, incidents, requests) and
 * insights (analysiss).
 *
 * Convention (matches backend, see [[feedback-override-suffix-convention]]):
 *   - <field>_oid           — default value (AI- or source-system-derived)
 *   - <field>_override_oid  — human-edited override
 *   - effective value at render time: override ?? default
 *
 * UI rule: never write to the default column directly. The "Save override"
 * action only sets <field>_override_oid; clearing it falls back to the
 * default once again.
 */

/** Return whichever of (override, default) is set; override wins. */
export function effectiveOid(
    defaultOid: string | null | undefined,
    overrideOid: string | null | undefined,
): string | null {
    if (overrideOid) return overrideOid;
    if (defaultOid) return defaultOid;
    return null;
}

/** True when the override is set AND differs from the default. */
export function hasMeaningfulOverride(
    defaultOid: string | null | undefined,
    overrideOid: string | null | undefined,
): boolean {
    if (!overrideOid) return false;
    if (!defaultOid) return true;
    return overrideOid !== defaultOid;
}

// Stable IDs used to root the two hierarchy trees behind the SC / ST pair.
export const SERVICE_CATALOG_ROOT_STABLE_ID = 'ITSC0000';
export const SERVICE_TYPE_ROOT_STABLE_ID = 'ITST0000';

// Path lengths of valid leaves under each root (root + intermediate + leaf).
export const SERVICE_CATALOG_LEAF_DEPTH = 4; // root + L1 + L2 + L3
export const SERVICE_TYPE_LEAF_DEPTH = 2; // root + leaf (Enquiry/Faulty/Requirement)
