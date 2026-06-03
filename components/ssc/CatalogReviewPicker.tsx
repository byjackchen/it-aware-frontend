'use client';

/**
 * Cascading hierarchy picker for service-catalog / service-type override fields.
 *
 * Generalized form:
 *   - `rootStableId` picks which tree to walk (defaults to ITSC0000 / IT Services).
 *     Passing ITST0000 turns this into a single-level "service type" picker.
 *   - `targetDepth` is the path length of a valid leaf (root + intermediate +
 *     leaf). The UI renders `targetDepth - 1` cascading dropdowns; the last
 *     one selects the leaf.
 *
 * Common configurations:
 *   - Service catalog (post 2026-05 restructure): rootStableId=ITSC0000,
 *     targetDepth=4 → three dropdowns (L1, L2, L3).
 *   - Service type:                                rootStableId=ITST0000,
 *     targetDepth=2 → one dropdown (type leaf).
 *
 * Used by SSC dashboard rows and the detail pages for activities/analyses.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { ServiceCatalog } from '@/lib/types/objects';

interface CatalogReviewPickerProps {
    /** Currently-saved OID (null when no override is set). */
    currentOid: string | null | undefined;
    /** All active service-catalog entries (the panel-level one-shot fetch result). */
    catalogEntries: ServiceCatalog[];
    /** Map of all entries by OID — used to render the trigger label when collapsed. */
    catalogByOid: Record<string, ServiceCatalog | undefined>;
    /** Persist the new OID. null = clear. */
    onCommit: (oid: string | null) => void;
    disabled?: boolean;
    /** Which tree to walk. Default: ITSC0000 (IT Services catalog). */
    rootStableId?: string;
    /** Path length of a valid leaf. Default: 4 (L3 leaf under IT Services). */
    targetDepth?: number;
    /** Optional override for the level labels in dropdowns. Length should be `targetDepth - 1`. */
    levelLabels?: string[];
    /** Text shown on the trigger when no value is set. */
    placeholder?: string;
    /** Title attribute on the trigger button. */
    titleHint?: string;
}

interface LevelEntry {
    oid: string;
    name: string;
}

const DEFAULT_ROOT_STABLE_ID = 'ITSC0000';
const DEFAULT_TARGET_DEPTH = 4;
const DEFAULT_SC_LEVEL_LABELS = [
    'L1 — Primary',
    'L2 — Secondary',
    'L3 — Leaf (required)',
];

export function CatalogReviewPicker({
    currentOid,
    catalogEntries,
    catalogByOid,
    onCommit,
    disabled,
    rootStableId = DEFAULT_ROOT_STABLE_ID,
    targetDepth = DEFAULT_TARGET_DEPTH,
    levelLabels,
    placeholder = 'Set override…',
    titleHint,
}: CatalogReviewPickerProps) {
    const [open, setOpen] = useState(false);
    const dropdownCount = Math.max(1, targetDepth - 1);

    // ── derive tree structure (root OID, children-by-parent index) ──
    const { rootOid, childrenByParent } = useMemo(() => {
        const root = catalogEntries.find(e => e.stable_id === rootStableId);
        const rootOidLocal = root?.oid ?? null;
        const idx: Record<string, LevelEntry[]> = {};
        for (const entry of catalogEntries) {
            if (!entry.oid || !entry.name) continue;
            const path = entry.path ?? [];
            // Skip root itself; only index nodes that have a parent.
            if (path.length < 2) continue;
            // Restrict to this tree (path[0] = root OID).
            if (rootOidLocal && path[0] !== rootOidLocal) continue;
            const parent = path[path.length - 2];
            if (!parent) continue;
            (idx[parent] ??= []).push({ oid: entry.oid, name: entry.name });
        }
        for (const bucket of Object.values(idx)) {
            bucket.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
        }
        return { rootOid: rootOidLocal, childrenByParent: idx };
    }, [catalogEntries, rootStableId]);

    // Pick-state is an array of length dropdownCount. Each slot is the OID
    // picked at that level (index 0 = first cascade after root).
    const [picked, setPicked] = useState<(string | null)[]>(() =>
        Array(dropdownCount).fill(null),
    );

    const prefillFromCurrent = useCallback(() => {
        if (!currentOid) {
            setPicked(Array(dropdownCount).fill(null));
            return;
        }
        const leaf = catalogByOid[currentOid];
        if (!leaf || (leaf.path ?? []).length !== targetDepth) {
            setPicked(Array(dropdownCount).fill(null));
            return;
        }
        const p = leaf.path ?? [];
        // path[0] = root, path[1..] = level picks
        setPicked(
            Array.from({ length: dropdownCount }, (_, i) => p[i + 1] ?? null),
        );
    }, [currentOid, catalogByOid, dropdownCount, targetDepth]);

    // Re-prefill whenever the current OID changes upstream (e.g. saved value
    // updates after a successful commit but the picker stays mounted).
    useEffect(() => {
        if (!open) prefillFromCurrent();
    }, [open, prefillFromCurrent]);

    const handleOpen = () => {
        if (disabled) return;
        prefillFromCurrent();
        setOpen(true);
    };

    const leafPick = picked[dropdownCount - 1];

    const handleSave = () => {
        if (leafPick) {
            onCommit(leafPick);
            setOpen(false);
        }
    };

    const handleClear = () => {
        onCommit(null);
        setOpen(false);
    };

    // Compute the option list for each cascade slot. Slot 0's parent is the
    // tree root; slot N's parent is the OID picked at slot N-1.
    const optionsAtSlot = (slot: number): LevelEntry[] => {
        if (slot === 0) return rootOid ? childrenByParent[rootOid] ?? [] : [];
        const parent = picked[slot - 1];
        return parent ? childrenByParent[parent] ?? [] : [];
    };

    const labels =
        levelLabels && levelLabels.length === dropdownCount
            ? levelLabels
            : dropdownCount === DEFAULT_SC_LEVEL_LABELS.length
            ? DEFAULT_SC_LEVEL_LABELS
            : Array.from({ length: dropdownCount }, (_, i) =>
                  i === dropdownCount - 1
                      ? `Level ${i + 1} (required)`
                      : `Level ${i + 1}`,
              );

    const resolvedLabel = currentOid
        ? catalogByOid[currentOid]?.name ?? currentOid
        : null;
    const buttonLabel = resolvedLabel ?? placeholder;
    const computedTitle =
        titleHint ?? resolvedLabel ?? 'Click to choose an override';

    return (
        <div className="relative w-full">
            <button
                type="button"
                disabled={disabled}
                onClick={handleOpen}
                className={`w-full flex items-center justify-between gap-1 text-xs px-2 py-1 rounded border bg-white dark:bg-slate-800/40 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                    resolvedLabel
                        ? 'border-slate-300 dark:border-white/20 text-slate-700 dark:text-gray-200'
                        : 'border-dashed border-slate-300 dark:border-white/15 text-slate-400 dark:text-gray-500 italic'
                }`}
                title={computedTitle}
            >
                <span className="truncate">{buttonLabel}</span>
                <ChevronDown className="w-3 h-3 flex-shrink-0 opacity-60" />
            </button>
            {open && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setOpen(false)}
                        aria-hidden
                    />
                    <div className="absolute z-50 left-0 top-full mt-1 w-[420px] rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl p-3 space-y-2">
                        {Array.from({ length: dropdownCount }).map((_, slot) => {
                            const opts = optionsAtSlot(slot);
                            const value = picked[slot];
                            const isDisabled = slot > 0 && !picked[slot - 1];
                            return (
                                <LevelSelect
                                    key={slot}
                                    label={labels[slot]}
                                    value={value}
                                    options={opts}
                                    disabled={isDisabled}
                                    onChange={v => {
                                        setPicked(prev => {
                                            const next = [...prev];
                                            next[slot] = v;
                                            // Clear deeper slots when an ancestor changes.
                                            for (let i = slot + 1; i < dropdownCount; i++) {
                                                next[i] = null;
                                            }
                                            return next;
                                        });
                                    }}
                                />
                            );
                        })}
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
                                    disabled={!leafPick}
                                    className="text-xs px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Save
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
