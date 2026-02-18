'use client';

import { useMemo, useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useLazyResourceList } from '@/lib/hooks/useLazyResourceList';
import { createCampaignNotificationAction } from '@/app/actions/campaigns';
import type {
    Location,
    NotificationChannel,
    NotificationContentBlock,
} from '@/lib/types/objects';
import { NotificationContentBlocksEditor } from './NotificationContentBlocksEditor';
import { NotificationDirectSpreadsheetCreate } from './NotificationDirectSpreadsheetCreate';
import { cloneContentBlocks, createEmptyBlock } from './utils';
import type { CreateEntryMode } from './types';
import { useAllActiveWorkers } from './useAllActiveWorkers';

function toggleSelection(current: string[], value: string): string[] {
    if (current.includes(value)) {
        return current.filter((item) => item !== value);
    }
    return [...current, value];
}

function hasInvalidContentBlocks(blocks: NotificationContentBlock[]): boolean {
    return blocks.some((block) => {
        if (block.text.trim().length === 0) return true;
        if (block.type === 'link' && block.url.trim().length === 0) return true;
        return false;
    });
}

interface LocationTreeNode {
    location: Location;
    children: LocationTreeNode[];
}

function buildLocationTree(locations: Location[]): {
    roots: LocationTreeNode[];
    byOid: Map<string, Location>;
    descendantsByOid: Map<string, string[]>;
} {
    const nodeByOid = new Map<string, LocationTreeNode>();
    const byOid = new Map<string, Location>();

    locations.forEach((location) => {
        nodeByOid.set(location.oid, {
            location,
            children: [],
        });
        byOid.set(location.oid, location);
    });

    const roots: LocationTreeNode[] = [];

    locations.forEach((location) => {
        const node = nodeByOid.get(location.oid);
        if (!node) return;

        if (location.parent_oid && nodeByOid.has(location.parent_oid)) {
            nodeByOid.get(location.parent_oid)!.children.push(node);
        } else {
            roots.push(node);
        }
    });

    const sortTree = (nodes: LocationTreeNode[]) => {
        nodes.sort((a, b) => a.location.name.localeCompare(b.location.name));
        nodes.forEach((node) => sortTree(node.children));
    };
    sortTree(roots);

    const descendantsByOid = new Map<string, string[]>();
    const collectDescendants = (node: LocationTreeNode): string[] => {
        const descendants = [node.location.oid];
        node.children.forEach((child) => {
            descendants.push(...collectDescendants(child));
        });
        descendantsByOid.set(node.location.oid, descendants);
        return descendants;
    };
    roots.forEach((root) => {
        collectDescendants(root);
    });

    return { roots, byOid, descendantsByOid };
}

function collectTreeNodeOids(nodes: LocationTreeNode[]): string[] {
    const oids: string[] = [];
    const walk = (node: LocationTreeNode) => {
        oids.push(node.location.oid);
        node.children.forEach(walk);
    };
    nodes.forEach(walk);
    return oids;
}

function hasIncludedAncestor(
    oid: string,
    included: Set<string>,
    byOid: Map<string, Location>
): boolean {
    let currentParentOid = byOid.get(oid)?.parent_oid ?? null;
    while (currentParentOid) {
        if (included.has(currentParentOid)) return true;
        currentParentOid = byOid.get(currentParentOid)?.parent_oid ?? null;
    }
    return false;
}

function isLocationEffectivelySelected(
    oid: string,
    included: Set<string>,
    excluded: Set<string>,
    byOid: Map<string, Location>
): boolean {
    if (included.size === 0) return false;
    if (excluded.has(oid)) return false;
    if (included.has(oid)) return true;
    return hasIncludedAncestor(oid, included, byOid);
}

export function NotificationCreateWizard() {
    const t = useTranslations('Campaign');
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';

    const [isPending, startTransition] = useTransition();
    const [createMode, setCreateMode] = useState<CreateEntryMode>('guided');
    const [step, setStep] = useState<1 | 2>(1);
    const [name, setName] = useState('');
    const [channel, setChannel] = useState<NotificationChannel>('wecom_bot');
    const [contentBlocks, setContentBlocks] = useState<NotificationContentBlock[]>([createEmptyBlock('text')]);
    const [error, setError] = useState<string | null>(null);

    const [includedLocationOids, setIncludedLocationOids] = useState<string[]>([]);
    const [excludedLocationOids, setExcludedLocationOids] = useState<string[]>([]);
    const [selectedWorkerTypes, setSelectedWorkerTypes] = useState<string[]>([]);
    const [manuallyDeselectedStableIds, setManuallyDeselectedStableIds] = useState<string[]>([]);
    const [manuallyAddedStableIds, setManuallyAddedStableIds] = useState<string[]>([]);
    const [manualStableId, setManualStableId] = useState('');
    const [expandedLocationOids, setExpandedLocationOids] = useState<Set<string>>(new Set());
    const [locationExpansionCustomized, setLocationExpansionCustomized] = useState(false);

    const {
        workers,
        isLoading: isWorkersLoading,
        error: workersError,
    } = useAllActiveWorkers();

    const { items: locations } = useLazyResourceList<Location>('locations', {
        auto: true,
        query: { limit: 1000, is_active: true },
    });

    const locationTree = useMemo(
        () => buildLocationTree(locations),
        [locations]
    );

    const rootLocationOids = useMemo(
        () => locationTree.roots.map((root) => root.location.oid),
        [locationTree.roots]
    );

    const defaultExpandedLocationOidSet = useMemo(
        () => new Set(rootLocationOids),
        [rootLocationOids]
    );

    const allLocationOids = useMemo(
        () => collectTreeNodeOids(locationTree.roots),
        [locationTree.roots]
    );

    const includedLocationOidSet = useMemo(
        () => new Set(includedLocationOids),
        [includedLocationOids]
    );
    const excludedLocationOidSet = useMemo(
        () => new Set(excludedLocationOids),
        [excludedLocationOids]
    );

    const selectedLocationOids = useMemo(() => {
        if (includedLocationOidSet.size === 0) return [];
        return locations
            .filter((location) => isLocationEffectivelySelected(
                location.oid,
                includedLocationOidSet,
                excludedLocationOidSet,
                locationTree.byOid
            ))
            .map((location) => location.oid);
    }, [excludedLocationOidSet, includedLocationOidSet, locationTree.byOid, locations]);

    const workerStableIdSet = useMemo(() => new Set(workers.map((worker) => worker.stable_id)), [workers]);

    const workerTypeOptions = useMemo(
        () => Array.from(new Set(workers.map((worker) => worker.worker_type).filter((type): type is string => Boolean(type)))).sort(),
        [workers]
    );

    const filteredWorkers = useMemo(() => {
        return workers.filter((worker) => {
            const locationMatch =
                selectedLocationOids.length === 0
                    ? true
                    : (worker.location_oid !== null && selectedLocationOids.includes(worker.location_oid));
            const workerTypeMatch =
                selectedWorkerTypes.length === 0
                    ? true
                    : (worker.worker_type !== null && selectedWorkerTypes.includes(worker.worker_type));

            return locationMatch && workerTypeMatch;
        });
    }, [workers, selectedLocationOids, selectedWorkerTypes]);

    const filteredWorkerStableIds = useMemo(
        () => filteredWorkers.map((worker) => worker.stable_id),
        [filteredWorkers]
    );

    const autoSelectedStableIds = useMemo(
        () => filteredWorkers.map((worker) => worker.stable_id),
        [filteredWorkers]
    );

    const selectedStableIdsByDimensions = useMemo(() => {
        const selected = new Set<string>();

        autoSelectedStableIds.forEach((stableId) => {
            if (!manuallyDeselectedStableIds.includes(stableId)) {
                selected.add(stableId);
            }
        });

        manuallyAddedStableIds.forEach((stableId) => {
            if (workerStableIdSet.has(stableId)) {
                selected.add(stableId);
            }
        });

        return Array.from(selected).sort((a, b) => a.localeCompare(b));
    }, [autoSelectedStableIds, manuallyAddedStableIds, manuallyDeselectedStableIds, workerStableIdSet]);

    const manuallyAddedOnlyStableIds = useMemo(
        () => selectedStableIdsByDimensions.filter((stableId) => !autoSelectedStableIds.includes(stableId)),
        [autoSelectedStableIds, selectedStableIdsByDimensions]
    );

    const canContinueStepOne =
        name.trim().length > 0 &&
        contentBlocks.length > 0 &&
        !hasInvalidContentBlocks(contentBlocks);

    const handleGuidedSubmit = () => {
        setError(null);

        if (selectedStableIdsByDimensions.length === 0) {
            setError(t('create.errors.noReceivers'));
            return;
        }

        if (!canContinueStepOne) {
            setError(t('create.errors.invalidContent'));
            return;
        }

        startTransition(async () => {
            const result = await createCampaignNotificationAction({
                name: name.trim(),
                channel,
                details: selectedStableIdsByDimensions.map((stableId) => ({
                    receiver_stable_id: stableId,
                    content_blocks: cloneContentBlocks(contentBlocks),
                    status: 'created',
                })),
            });

            if (!result.success) {
                setError(result.error);
                return;
            }

            router.push(`/campaign/notifications?notification=${encodeURIComponent(result.data.oid)}`);
            router.refresh();
        });
    };

    const handleManualAdd = () => {
        const stableId = manualStableId.trim();
        if (!stableId) return;
        if (!workerStableIdSet.has(stableId)) {
            setError(t('create.errors.receiverNotFound'));
            return;
        }

        if (autoSelectedStableIds.includes(stableId)) {
            setManuallyDeselectedStableIds((current) => current.filter((item) => item !== stableId));
        } else {
            setManuallyAddedStableIds((current) => {
                if (current.includes(stableId)) return current;
                return [...current, stableId].sort((a, b) => a.localeCompare(b));
            });
        }

        setManualStableId('');
        setError(null);
    };

    const handleSelectAllWorkers = () => {
        const visibleStableIdSet = new Set(filteredWorkerStableIds);
        setManuallyDeselectedStableIds((current) => current.filter((stableId) => !visibleStableIdSet.has(stableId)));
    };

    const handleUnselectAllWorkers = () => {
        const visibleStableIdSet = new Set(filteredWorkerStableIds);
        setManuallyAddedStableIds((current) => current.filter((stableId) => !visibleStableIdSet.has(stableId)));
        setManuallyDeselectedStableIds((current) => {
            const next = new Set(current);
            filteredWorkerStableIds.forEach((stableId) => next.add(stableId));
            return Array.from(next).sort((a, b) => a.localeCompare(b));
        });
    };

    const handleLocationToggle = (locationOid: string) => {
        const currentlySelected = isLocationEffectivelySelected(
            locationOid,
            includedLocationOidSet,
            excludedLocationOidSet,
            locationTree.byOid
        );

        if (currentlySelected) {
            if (includedLocationOidSet.has(locationOid)) {
                setIncludedLocationOids((current) => current.filter((oid) => oid !== locationOid));
                setExcludedLocationOids((current) => current.filter((oid) => oid !== locationOid));
            } else {
                setExcludedLocationOids((current) => {
                    if (current.includes(locationOid)) return current;
                    return [...current, locationOid];
                });
            }
            return;
        }

        const ancestorIncluded = hasIncludedAncestor(locationOid, includedLocationOidSet, locationTree.byOid);
        if (ancestorIncluded) {
            setExcludedLocationOids((current) => current.filter((oid) => oid !== locationOid));
            return;
        }

        setIncludedLocationOids((current) => {
            if (current.includes(locationOid)) return current;
            return [...current, locationOid];
        });
        setExcludedLocationOids((current) => current.filter((oid) => oid !== locationOid));
    };

    const toggleLocationExpanded = (locationOid: string) => {
        setLocationExpansionCustomized(true);
        setExpandedLocationOids((current) => {
            const next = new Set(current);
            if (next.has(locationOid)) {
                next.delete(locationOid);
            } else {
                next.add(locationOid);
            }
            return next;
        });
    };

    const expandAllLocations = () => {
        setLocationExpansionCustomized(true);
        setExpandedLocationOids(new Set(allLocationOids));
    };

    const collapseAllLocations = () => {
        setLocationExpansionCustomized(true);
        setExpandedLocationOids(new Set());
    };

    const renderLocationNode = (node: LocationTreeNode, level = 0): ReactElement => {
        const descendants = locationTree.descendantsByOid.get(node.location.oid) ?? [node.location.oid];
        const selectedCount = descendants.reduce((count, oid) => {
            return count + (
                isLocationEffectivelySelected(
                    oid,
                    includedLocationOidSet,
                    excludedLocationOidSet,
                    locationTree.byOid
                ) ? 1 : 0
            );
        }, 0);

        const checked = descendants.length > 0 && selectedCount === descendants.length;
        const indeterminate = selectedCount > 0 && selectedCount < descendants.length;
        const hasChildren = node.children.length > 0;
        const isExpanded = locationExpansionCustomized
            ? expandedLocationOids.has(node.location.oid)
            : defaultExpandedLocationOidSet.has(node.location.oid);

        return (
            <div key={node.location.oid} className="space-y-1">
                <div
                    className={`flex items-center gap-1.5 text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}
                    style={{ paddingLeft: `${level * 14}px` }}
                >
                    <button
                        type="button"
                        onClick={() => toggleLocationExpanded(node.location.oid)}
                        className={`w-4 h-4 inline-flex items-center justify-center rounded ${hasChildren ? (isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10') : 'text-transparent cursor-default'}`}
                        disabled={!hasChildren}
                        aria-label={hasChildren ? (isExpanded ? t('receivers.collapse') : t('receivers.expand')) : undefined}
                    >
                        {hasChildren && (isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />)}
                    </button>
                    <input
                        ref={(element) => {
                            if (element) {
                                element.indeterminate = indeterminate;
                            }
                        }}
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleLocationToggle(node.location.oid)}
                    />
                    <span>{node.location.name}</span>
                </div>
                {hasChildren && isExpanded && (
                    <div className="space-y-1">
                        {node.children.map((child) => renderLocationNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push('/campaign/notifications')}
                        className={`p-2 rounded-lg ${isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-gray-300'}`}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className={`text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t('create.title')}</h1>
                        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('create.subtitle')}</p>
                    </div>
                </div>

                <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setCreateMode('guided');
                                setError(null);
                            }}
                            className={`px-3 py-1.5 rounded-md border text-sm ${createMode === 'guided' ? 'border-blue-400 bg-blue-500/20 text-blue-200' : isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-300'}`}
                        >
                            {t('create.entryModes.guided')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCreateMode('excel_direct');
                                setError(null);
                            }}
                            className={`px-3 py-1.5 rounded-md border text-sm ${createMode === 'excel_direct' ? 'border-blue-400 bg-blue-500/20 text-blue-200' : isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-300'}`}
                        >
                            {t('create.entryModes.excelDirect')}
                        </button>
                    </div>
                </section>

                {createMode === 'excel_direct' && (
                    <NotificationDirectSpreadsheetCreate
                        validStableIds={Array.from(workerStableIdSet)}
                        isWorkersLoading={isWorkersLoading}
                        workersError={workersError}
                    />
                )}

                {createMode === 'guided' && (
                    <>
                        <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`w-6 h-6 rounded-full border text-xs flex items-center justify-center ${step === 1 ? 'border-blue-400 text-blue-300' : 'border-emerald-400 text-emerald-300'}`}>
                                    {step === 1 ? '1' : <Check className="w-3.5 h-3.5" />}
                                </div>
                                <span className={`text-sm ${step === 1 ? 'text-blue-300' : isLight ? 'text-slate-700' : 'text-gray-300'}`}>{t('create.steps.content')}</span>
                                <div className="h-px flex-1 bg-white/10" />
                                <div className={`w-6 h-6 rounded-full border text-xs flex items-center justify-center ${step === 2 ? 'border-blue-400 text-blue-300' : 'border-slate-500 text-slate-400'}`}>
                                    2
                                </div>
                                <span className={`text-sm ${step === 2 ? 'text-blue-300' : isLight ? 'text-slate-700' : 'text-gray-300'}`}>{t('create.steps.receivers')}</span>
                            </div>
                        </div>

                        {error && (
                            <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
                                {error}
                            </div>
                        )}

                        {step === 1 && (
                            <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={`block text-sm mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('create.fields.name')}</label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(event) => setName(event.target.value)}
                                            placeholder={t('create.fields.namePlaceholder')}
                                            className={`w-full px-3 py-2 rounded-md border ${isLight ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                        />
                                    </div>
                                    <div>
                                        <label className={`block text-sm mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('create.fields.channel')}</label>
                                        <select
                                            value={channel}
                                            onChange={(event) => setChannel(event.target.value as NotificationChannel)}
                                            className={`w-full px-3 py-2 rounded-md border ${isLight ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                        >
                                            <option value="wecom_bot">wecom_bot</option>
                                            <option value="wecom_ops_bot">wecom_ops_bot</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className={`block text-sm mb-2 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('create.fields.contentBlocks')}</label>
                                    <NotificationContentBlocksEditor blocks={contentBlocks} onChange={setContentBlocks} />
                                </div>

                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => setStep(2)}
                                        disabled={!canContinueStepOne}
                                        className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                                    >
                                        {t('create.actions.next')}
                                    </button>
                                </div>
                            </section>
                        )}

                        {step === 2 && (
                            <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{t('receivers.filters.location')}</p>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={expandAllLocations}
                                                        className={`px-2 py-1 rounded-md border text-xs ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-gray-300 hover:bg-white/10'}`}
                                                    >
                                                        {t('receivers.expandAll')}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={collapseAllLocations}
                                                        className={`px-2 py-1 rounded-md border text-xs ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-gray-300 hover:bg-white/10'}`}
                                                    >
                                                        {t('receivers.collapseAll')}
                                                    </button>
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-400">{t('receivers.locationTreeHint')}</p>
                                            <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-2">
                                                {locationTree.roots.length === 0 ? (
                                                    <p className="text-xs text-gray-500">{t('receivers.noLocations')}</p>
                                                ) : (
                                                    locationTree.roots.map((root) => renderLocationNode(root))
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <p className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{t('receivers.filters.workerType')}</p>
                                            <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-2">
                                                {workerTypeOptions.map((workerType) => (
                                                    <label key={workerType} className={`flex items-center gap-2 text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedWorkerTypes.includes(workerType)}
                                                            onChange={() => setSelectedWorkerTypes((current) => toggleSelection(current, workerType))}
                                                        />
                                                        <span>{workerType}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-lg border border-white/10 p-3 space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                                {t('receivers.autoSelectedCount', {
                                                    count: selectedStableIdsByDimensions.length,
                                                })}
                                            </p>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={handleSelectAllWorkers}
                                                    disabled={filteredWorkerStableIds.length === 0}
                                                    className={`px-2 py-1 rounded-md border text-xs ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-gray-300 hover:bg-white/10'} disabled:opacity-50`}
                                                >
                                                    {t('receivers.selectAll')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleUnselectAllWorkers}
                                                    disabled={filteredWorkerStableIds.length === 0}
                                                    className={`px-2 py-1 rounded-md border text-xs ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-gray-300 hover:bg-white/10'} disabled:opacity-50`}
                                                >
                                                    {t('receivers.unselectAll')}
                                                </button>
                                                <input
                                                    type="text"
                                                    value={manualStableId}
                                                    onChange={(event) => setManualStableId(event.target.value)}
                                                    placeholder={t('receivers.manualAddPlaceholder')}
                                                    className={`px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleManualAdd}
                                                    className="px-3 py-1.5 text-sm rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20"
                                                >
                                                    {t('receivers.manualAdd')}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="max-h-56 overflow-y-auto space-y-1">
                                            {filteredWorkers.map((worker) => {
                                                const checked = selectedStableIdsByDimensions.includes(worker.stable_id);
                                                return (
                                                    <label key={worker.oid} className={`flex items-center gap-2 text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => {
                                                                if (checked) {
                                                                    setManuallyAddedStableIds((current) => current.filter((item) => item !== worker.stable_id));
                                                                    setManuallyDeselectedStableIds((current) => {
                                                                        if (current.includes(worker.stable_id)) return current;
                                                                        return [...current, worker.stable_id];
                                                                    });
                                                                } else {
                                                                    setManuallyDeselectedStableIds((current) => current.filter((item) => item !== worker.stable_id));
                                                                }
                                                            }}
                                                        />
                                                        <span>{worker.fullname}</span>
                                                        <span className="text-xs text-gray-500">{worker.stable_id}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        {manuallyAddedOnlyStableIds.length > 0 && (
                                            <div className="pt-2 border-t border-white/10">
                                                <p className="text-xs text-gray-400 mb-2">{t('receivers.manualAdded')}</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {manuallyAddedOnlyStableIds.map((stableId) => (
                                                        <button
                                                            key={stableId}
                                                            type="button"
                                                            onClick={() => setManuallyAddedStableIds((current) => current.filter((item) => item !== stableId))}
                                                            className="px-2 py-1 rounded-full border border-white/20 text-xs text-gray-200 hover:bg-white/10"
                                                        >
                                                            {stableId} ×
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {(isWorkersLoading || workersError) && (
                                    <div className="text-sm text-gray-300">
                                        {isWorkersLoading ? t('receivers.loadingWorkers') : workersError}
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className={`px-4 py-2 rounded-md border ${isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-200'}`}
                                    >
                                        {t('create.actions.back')}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleGuidedSubmit}
                                        disabled={isPending}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                                    >
                                        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                        <span>{t('create.actions.create')}</span>
                                    </button>
                                </div>
                            </section>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
