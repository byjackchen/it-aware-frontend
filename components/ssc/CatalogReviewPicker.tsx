'use client';

/**
 * Cascading service-catalog picker for the SSC review override field.
 *
 * Constraints:
 *   - Forces selection of a 4th-level (leaf) node — Save is disabled until
 *     all four cascading dropdowns are populated.
 *   - Trigger is an inline button showing the current resolved leaf name
 *     (or "—" when null); click opens a small popover with L1 → L2 → L3 → L4
 *     selects.
 *   - "Clear" sets the value to null. "Save" commits the L4 OID.
 *
 * Lives next to the SSC dashboard and the interaction detail page; both
 * surface review_service_catalog_oid edits via PATCH /interactions/{oid}/review.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ServiceCatalog } from '@/lib/types/objects';

const SERVICE_CATALOG_ROOT_STABLE_ID = 'ITSC0000';
const L4_PATH_LENGTH = 5;

interface CatalogReviewPickerProps {
    /** Currently-saved OID (null when no review override is set). */
    currentOid: string | null | undefined;
    /** All active service-catalog entries (the panel-level one-shot fetch result). */
    catalogEntries: ServiceCatalog[];
    /**
     * Map of all entries by OID — used to render the cell label when
     * `currentOid` is set but the picker isn't open. Caller usually already
     * has this map for the read-only ai_service_catalog_oid cell; reuse it.
     */
    catalogByOid: Record<string, ServiceCatalog | undefined>;
    /** Persist the new OID. null = clear. */
    onCommit: (oid: string | null) => void;
    disabled?: boolean;
}

interface LevelEntry {
    oid: string;
    name: string;
}

export function CatalogReviewPicker({
    currentOid,
    catalogEntries,
    catalogByOid,
    onCommit,
    disabled,
}: CatalogReviewPickerProps) {
    const [open, setOpen] = useState(false);

    // ── derive tree structure (root OID, children-by-parent index) ──
    const { rootOid, childrenByParent } = useMemo(() => {
        const root = catalogEntries.find(
            e => e.stable_id === SERVICE_CATALOG_ROOT_STABLE_ID,
        );
        const rootOidLocal = root?.oid ?? null;
        const idx: Record<string, LevelEntry[]> = {};
        for (const entry of catalogEntries) {
            if (!entry.oid || !entry.name) continue;
            const path = entry.path ?? [];
            // Skip root itself; only index L1+
            if (path.length < 2) continue;
            // Restrict to IT Services subtree (path[0] = root OID).
            if (rootOidLocal && path[0] !== rootOidLocal) continue;
            const parent = path[path.length - 2];
            if (!parent) continue;
            (idx[parent] ??= []).push({ oid: entry.oid, name: entry.name });
        }
        // Sort each bucket by name for stable presentation
        for (const bucket of Object.values(idx)) {
            bucket.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
        }
        return { rootOid: rootOidLocal, childrenByParent: idx };
    }, [catalogEntries]);

    // ── pick-state: L1/L2/L3/L4 OIDs, pre-populated from currentOid on open ──
    const [picked, setPicked] = useState<{
        l1: string | null;
        l2: string | null;
        l3: string | null;
        l4: string | null;
    }>({ l1: null, l2: null, l3: null, l4: null });

    const prefillFromCurrent = useCallback(() => {
        if (!currentOid) {
            setPicked({ l1: null, l2: null, l3: null, l4: null });
            return;
        }
        const leaf = catalogByOid[currentOid];
        if (!leaf || (leaf.path ?? []).length !== L4_PATH_LENGTH) {
            setPicked({ l1: null, l2: null, l3: null, l4: null });
            return;
        }
        const p = leaf.path ?? [];
        setPicked({
            l1: p[1] ?? null,
            l2: p[2] ?? null,
            l3: p[3] ?? null,
            l4: p[4] ?? null,
        });
    }, [currentOid, catalogByOid]);

    const handleOpen = () => {
        if (disabled) return;
        prefillFromCurrent();
        setOpen(true);
    };

    const handleSave = () => {
        if (picked.l4) {
            onCommit(picked.l4);
            setOpen(false);
        }
    };

    const handleClear = () => {
        onCommit(null);
        setOpen(false);
    };

    const l1Options = rootOid ? childrenByParent[rootOid] ?? [] : [];
    const l2Options = picked.l1 ? childrenByParent[picked.l1] ?? [] : [];
    const l3Options = picked.l2 ? childrenByParent[picked.l2] ?? [] : [];
    const l4Options = picked.l3 ? childrenByParent[picked.l3] ?? [] : [];

    const currentLabel = currentOid
        ? catalogByOid[currentOid]?.name ?? currentOid
        : '—';

    // Trigger renders inline as a clickable cell; popover anchors below.
    return (
        <div className="relative w-full">
            <button
                type="button"
                disabled={disabled}
                onClick={handleOpen}
                className="w-full text-left text-xs px-1 py-0.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 truncate disabled:opacity-50"
                title={currentLabel}
            >
                {currentLabel}
            </button>
            {open && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpen(false)}
                        aria-hidden
                    />
                    <div className="absolute z-50 left-0 top-full mt-1 w-[420px] rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl p-3 space-y-2">
                        <LevelSelect
                            label="L1 — Primary"
                            value={picked.l1}
                            options={l1Options}
                            onChange={v =>
                                setPicked({ l1: v, l2: null, l3: null, l4: null })
                            }
                        />
                        <LevelSelect
                            label="L2 — Secondary"
                            value={picked.l2}
                            options={l2Options}
                            disabled={!picked.l1}
                            onChange={v =>
                                setPicked(p => ({ ...p, l2: v, l3: null, l4: null }))
                            }
                        />
                        <LevelSelect
                            label="L3 — Category"
                            value={picked.l3}
                            options={l3Options}
                            disabled={!picked.l2}
                            onChange={v =>
                                setPicked(p => ({ ...p, l3: v, l4: null }))
                            }
                        />
                        <LevelSelect
                            label="L4 — Leaf (required)"
                            value={picked.l4}
                            options={l4Options}
                            disabled={!picked.l3}
                            onChange={v => setPicked(p => ({ ...p, l4: v }))}
                        />
                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-white/10">
                            <button
                                type="button"
                                onClick={handleClear}
                                disabled={!currentOid}
                                className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                            >
                                Clear override
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="text-xs px-2 py-1 rounded text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={!picked.l4}
                                    className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Save L4
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

interface LevelSelectProps {
    label: string;
    value: string | null;
    options: LevelEntry[];
    disabled?: boolean;
    onChange: (oid: string | null) => void;
}

function LevelSelect({ label, value, options, disabled, onChange }: LevelSelectProps) {
    return (
        <label className="block text-xs">
            <span className="block opacity-60 mb-1">{label}</span>
            <select
                className="w-full text-xs px-2 py-1 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-slate-800 disabled:opacity-40"
                value={value ?? ''}
                disabled={disabled || options.length === 0}
                onChange={e => onChange(e.target.value || null)}
            >
                <option value="">— select —</option>
                {options.map(o => (
                    <option key={o.oid} value={o.oid}>
                        {o.name}
                    </option>
                ))}
            </select>
        </label>
    );
}
