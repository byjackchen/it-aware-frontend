'use client';

import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLazyResourceList } from '@/lib/hooks/useLazyResourceList';
import type { Location, Worker } from '@/lib/types/objects';

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

function toggleSelection(current: string[], value: string): string[] {
    if (current.includes(value)) {
        return current.filter((item) => item !== value);
    }
    return [...current, value];
}

interface CampaignReceiverSelectorProps {
    namespace: 'Campaign' | 'CampaignSurvey';
    sectionTitle: string;
    isLight: boolean;
    workers: Worker[];
    isWorkersLoading: boolean;
    workersError: string | null;
    onSelectionChange: (stableIds: string[]) => void;
    onErrorChange?: (error: string | null) => void;
}

export function CampaignReceiverSelector({
    namespace,
    sectionTitle,
    isLight,
    workers,
    isWorkersLoading,
    workersError,
    onSelectionChange,
    onErrorChange,
}: CampaignReceiverSelectorProps) {
    const t = useTranslations(namespace);

    const [selectedLocationOids, setSelectedLocationOids] = useState<string[]>([]);
    const [selectedWorkerTypes, setSelectedWorkerTypes] = useState<string[]>([]);
    const [manuallyDeselectedStableIds, setManuallyDeselectedStableIds] = useState<string[]>([]);
    const [manuallyAddedStableIds, setManuallyAddedStableIds] = useState<string[]>([]);
    const [manualStableId, setManualStableId] = useState('');
    const [expandedLocationOids, setExpandedLocationOids] = useState<Set<string>>(new Set());
    const [locationExpansionCustomized, setLocationExpansionCustomized] = useState(false);

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

    const selectedLocationOidSet = useMemo(
        () => new Set(selectedLocationOids),
        [selectedLocationOids]
    );

    const workerByStableId = useMemo(() => {
        const byStableId = new Map<string, Worker>();
        workers.forEach((worker) => {
            byStableId.set(worker.stable_id, worker);
        });
        return byStableId;
    }, [workers]);

    const workerTypeOptions = useMemo(
        () => Array.from(new Set(workers.map((worker) => worker.worker_type).filter((type): type is string => Boolean(type)))).sort(),
        [workers]
    );

    const filteredWorkers = useMemo(() => {
        return workers.filter((worker) => {
            const locationMatch =
                selectedLocationOids.length === 0
                    ? true
                    : (worker.location_oid !== null && selectedLocationOidSet.has(worker.location_oid));
            const workerTypeMatch =
                selectedWorkerTypes.length === 0
                    ? true
                    : (worker.worker_type !== null && selectedWorkerTypes.includes(worker.worker_type));

            return locationMatch && workerTypeMatch;
        });
    }, [selectedLocationOidSet, selectedLocationOids.length, selectedWorkerTypes, workers]);

    const filteredWorkerStableIds = useMemo(
        () => filteredWorkers.map((worker) => worker.stable_id),
        [filteredWorkers]
    );
    const filteredWorkerStableIdSet = useMemo(
        () => new Set(filteredWorkerStableIds),
        [filteredWorkerStableIds]
    );

    const hasAutoSelectionCriteria = selectedLocationOids.length > 0 || selectedWorkerTypes.length > 0;

    const autoSelectedStableIds = useMemo(() => {
        if (!hasAutoSelectionCriteria) return [];
        return filteredWorkers.map((worker) => worker.stable_id);
    }, [filteredWorkers, hasAutoSelectionCriteria]);

    const autoSelectedStableIdSet = useMemo(
        () => new Set(autoSelectedStableIds),
        [autoSelectedStableIds]
    );

    const selectedStableIdsByDimensions = useMemo(() => {
        const selected = new Set<string>();

        autoSelectedStableIds.forEach((stableId) => {
            if (!manuallyDeselectedStableIds.includes(stableId)) {
                selected.add(stableId);
            }
        });

        manuallyAddedStableIds.forEach((stableId) => {
            selected.add(stableId);
        });

        return Array.from(selected).sort((a, b) => a.localeCompare(b));
    }, [autoSelectedStableIds, manuallyAddedStableIds, manuallyDeselectedStableIds]);
    const selectedStableIdSet = useMemo(
        () => new Set(selectedStableIdsByDimensions),
        [selectedStableIdsByDimensions]
    );
    const manuallyAddedStableIdSet = useMemo(
        () => new Set(manuallyAddedStableIds),
        [manuallyAddedStableIds]
    );
    const unifiedReceiverRows = useMemo(() => {
        const seen = new Set<string>();
        const rows: Array<{ stableId: string; worker: Worker | null }> = [];

        filteredWorkers.forEach((worker) => {
            if (seen.has(worker.stable_id)) return;
            seen.add(worker.stable_id);
            rows.push({ stableId: worker.stable_id, worker });
        });

        manuallyAddedStableIds.forEach((stableId) => {
            if (seen.has(stableId)) return;
            seen.add(stableId);
            rows.push({ stableId, worker: workerByStableId.get(stableId) ?? null });
        });

        return rows;
    }, [filteredWorkers, manuallyAddedStableIds, workerByStableId]);
    const orderedUnifiedReceiverRows = useMemo(() => {
        const rows = [...unifiedReceiverRows];
        rows.sort((a, b) => {
            const aSelected = selectedStableIdSet.has(a.stableId);
            const bSelected = selectedStableIdSet.has(b.stableId);
            if (aSelected !== bSelected) {
                return aSelected ? -1 : 1;
            }
            return a.stableId.localeCompare(b.stableId);
        });
        return rows;
    }, [selectedStableIdSet, unifiedReceiverRows]);

    useEffect(() => {
        onSelectionChange(selectedStableIdsByDimensions);
    }, [onSelectionChange, selectedStableIdsByDimensions]);

    const handleManualAdd = () => {
        const stableId = manualStableId.trim();
        if (!stableId) return;

        if (autoSelectedStableIdSet.has(stableId)) {
            setManuallyDeselectedStableIds((current) => current.filter((item) => item !== stableId));
        } else {
            setManuallyAddedStableIds((current) => {
                if (current.includes(stableId)) return current;
                return [...current, stableId].sort((a, b) => a.localeCompare(b));
            });
        }

        setManualStableId('');
        onErrorChange?.(null);
    };

    const handleSelectAllWorkers = () => {
        const visibleStableIdSet = new Set(filteredWorkerStableIds);
        setManuallyDeselectedStableIds((current) => current.filter((stableId) => !visibleStableIdSet.has(stableId)));
        setManuallyAddedStableIds((current) => {
            const next = new Set(current);
            filteredWorkerStableIds.forEach((stableId) => {
                if (!autoSelectedStableIdSet.has(stableId)) {
                    next.add(stableId);
                }
            });
            return Array.from(next).sort((a, b) => a.localeCompare(b));
        });
    };

    const handleUnselectAllWorkers = () => {
        const visibleStableIdSet = new Set(filteredWorkerStableIds);
        setManuallyAddedStableIds((current) => current.filter((stableId) => !visibleStableIdSet.has(stableId)));
        setManuallyDeselectedStableIds((current) => {
            const next = new Set(current);
            filteredWorkerStableIds.forEach((stableId) => {
                if (autoSelectedStableIdSet.has(stableId)) {
                    next.add(stableId);
                }
            });
            return Array.from(next).sort((a, b) => a.localeCompare(b));
        });
    };

    const handleLocationToggle = (locationOid: string) => {
        const descendants = locationTree.descendantsByOid.get(locationOid) ?? [locationOid];
        const allSelected = descendants.every((oid) => selectedLocationOidSet.has(oid));

        setSelectedLocationOids((current) => {
            const next = new Set(current);
            if (allSelected) {
                descendants.forEach((oid) => next.delete(oid));
            } else {
                descendants.forEach((oid) => next.add(oid));
            }
            return Array.from(next).sort((a, b) => a.localeCompare(b));
        });
    };

    const toggleLocationExpanded = (locationOid: string) => {
        setExpandedLocationOids((current) => {
            const next = new Set(locationExpansionCustomized ? current : defaultExpandedLocationOidSet);
            if (next.has(locationOid)) {
                next.delete(locationOid);
            } else {
                next.add(locationOid);
            }
            return next;
        });
        setLocationExpansionCustomized(true);
    };

    const expandAllLocations = () => {
        setLocationExpansionCustomized(true);
        setExpandedLocationOids(new Set(allLocationOids));
    };

    const collapseAllLocations = () => {
        setLocationExpansionCustomized(true);
        setExpandedLocationOids(new Set());
    };
    const selectAllLocations = () => {
        setSelectedLocationOids(allLocationOids);
    };
    const unselectAllLocations = () => {
        setSelectedLocationOids([]);
    };
    const selectAllWorkerTypes = () => {
        setSelectedWorkerTypes(workerTypeOptions);
    };
    const unselectAllWorkerTypes = () => {
        setSelectedWorkerTypes([]);
    };

    const handleReceiverToggle = (stableId: string, checked: boolean) => {
        if (checked) {
            setManuallyDeselectedStableIds((current) => current.filter((item) => item !== stableId));
            if (!autoSelectedStableIdSet.has(stableId)) {
                setManuallyAddedStableIds((current) => {
                    if (current.includes(stableId)) return current;
                    return [...current, stableId].sort((a, b) => a.localeCompare(b));
                });
            }
            return;
        }

        if (autoSelectedStableIdSet.has(stableId)) {
            setManuallyDeselectedStableIds((current) => {
                if (current.includes(stableId)) return current;
                return [...current, stableId].sort((a, b) => a.localeCompare(b));
            });
        }
        setManuallyAddedStableIds((current) => current.filter((item) => item !== stableId));
    };

    const renderLocationNode = (node: LocationTreeNode, level = 0): ReactElement => {
        const descendants = locationTree.descendantsByOid.get(node.location.oid) ?? [node.location.oid];
        const selectedCount = descendants.reduce((count, oid) => {
            return count + (selectedLocationOidSet.has(oid) ? 1 : 0);
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
                        aria-label={hasChildren ? (isExpanded ? t('receivers.collapseAll') : t('receivers.expandAll')) : undefined}
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
        <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
            <h2 className={`text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{sectionTitle}</h2>
            <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{t('receivers.filters.location')}</p>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={selectAllLocations}
                                    disabled={allLocationOids.length === 0}
                                    className={`px-2 py-1 rounded-md border text-xs ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-gray-300 hover:bg-white/10'} disabled:opacity-50`}
                                >
                                    {t('receivers.selectAll')}
                                </button>
                                <button
                                    type="button"
                                    onClick={unselectAllLocations}
                                    disabled={allLocationOids.length === 0}
                                    className={`px-2 py-1 rounded-md border text-xs ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-gray-300 hover:bg-white/10'} disabled:opacity-50`}
                                >
                                    {t('receivers.unselectAll')}
                                </button>
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
                        <div className="flex items-center justify-between gap-2">
                            <p className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{t('receivers.filters.workerType')}</p>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={selectAllWorkerTypes}
                                    disabled={workerTypeOptions.length === 0}
                                    className={`px-2 py-1 rounded-md border text-xs ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-gray-300 hover:bg-white/10'} disabled:opacity-50`}
                                >
                                    {t('receivers.selectAll')}
                                </button>
                                <button
                                    type="button"
                                    onClick={unselectAllWorkerTypes}
                                    disabled={workerTypeOptions.length === 0}
                                    className={`px-2 py-1 rounded-md border text-xs ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-gray-300 hover:bg-white/10'} disabled:opacity-50`}
                                >
                                    {t('receivers.unselectAll')}
                                </button>
                            </div>
                        </div>
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
                        {orderedUnifiedReceiverRows.map(({ stableId, worker }) => {
                            const checked = selectedStableIdSet.has(stableId);
                            const isAutoSelected = autoSelectedStableIdSet.has(stableId);
                            const isManualSelected = checked && manuallyAddedStableIdSet.has(stableId) && !isAutoSelected;
                            const isUnknownManualSelected = isManualSelected && !workerByStableId.has(stableId);

                            const sourceLabel = !checked
                                ? null
                                : isAutoSelected
                                    ? t('receivers.sources.selected')
                                    : isUnknownManualSelected
                                        ? t('receivers.sources.manualExternal')
                                        : isManualSelected
                                            ? t('receivers.sources.manual')
                                            : null;

                            return (
                                <label key={stableId} className={`flex items-center gap-2 text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(event) => handleReceiverToggle(stableId, event.target.checked)}
                                    />
                                    <span>{worker?.fullname || stableId}</span>
                                    <span className="text-xs text-gray-500">{stableId}</span>
                                    {sourceLabel && (
                                        <span className={`px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wide ${isLight ? 'border-slate-300 text-slate-600' : 'border-white/20 text-gray-300'}`}>
                                            {sourceLabel}
                                        </span>
                                    )}
                                    {isManualSelected && worker && !filteredWorkerStableIdSet.has(stableId) && (
                                        <span className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                            {t('receivers.sources.outsideFilter')}
                                        </span>
                                    )}
                                </label>
                            );
                        })}
                        {orderedUnifiedReceiverRows.length === 0 && (
                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {t('receivers.empty')}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {(isWorkersLoading || workersError) && (
                <div className="text-sm text-gray-300">
                    {isWorkersLoading ? t('receivers.loadingWorkers') : workersError}
                </div>
            )}
        </section>
    );
}
