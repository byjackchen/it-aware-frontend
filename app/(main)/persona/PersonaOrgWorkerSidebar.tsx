'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useInfiniteResource } from '@/lib/hooks/useInfiniteResource';
import { buildHierarchyTree } from '@/lib/utils/hierarchy';
import type { HierarchyTreeNode, Organization, Worker } from '@/lib/types/objects';

const WORKERS_PAGE_LIMIT = 500;
const WORKERS_MAX_PAGES = 20;
const SIDEBAR_STATE_CACHE = {
    query: '',
    expandedOrgOids: new Set<string>(),
    expandedWorkerOrgOids: new Set<string>(),
    workersByOrg: new Map<string, Worker[]>(),
    workerSearchQuery: '',
    workerSearchHits: [] as Worker[],
    scrollTop: 0,
};

interface WorkersEnvelope {
    items: Worker[];
    total?: number;
}

interface PersonaOrgWorkerSidebarProps {
    currentWorker: Worker;
}

interface OrgTreeNodeProps {
    node: HierarchyTreeNode;
    level: number;
    expandedOrgOids: Set<string>;
    expandedWorkerOrgOids: Set<string>;
    autoExpandOrg: boolean;
    autoExpandedWorkerOrgOids: Set<string>;
    workersByOrg: Map<string, Worker[]>;
    loadingWorkerOrgOids: Set<string>;
    hasWorkerSearchMatch: boolean;
    workerSearchHitOrgOids: Set<string>;
    workerSearchHitOids: Set<string>;
    currentWorker: Worker;
    isLight: boolean;
    loadingWorkersText: string;
    noWorkersText: string;
    onToggleOrg: (oid: string) => void;
    onToggleWorkers: (oid: string) => void;
    onSelectWorker: (oid: string) => void;
}

function isWorkersEnvelope(value: unknown): value is WorkersEnvelope {
    if (!value || typeof value !== 'object') return false;
    return Array.isArray((value as { items?: unknown }).items);
}

function dedupeWorkers(workers: Worker[]): Worker[] {
    const seen = new Set<string>();
    const result: Worker[] = [];

    workers.forEach((worker) => {
        if (seen.has(worker.oid)) return;
        seen.add(worker.oid);
        result.push(worker);
    });

    return result;
}

async function fetchWorkersByFilters(filters: Record<string, string>): Promise<Worker[]> {
    let skip = 0;
    let pageCount = 0;
    let knownTotal: number | null = null;
    const loaded: Worker[] = [];

    while (pageCount < WORKERS_MAX_PAGES) {
        const params = new URLSearchParams(filters);
        params.set('skip', String(skip));
        params.set('limit', String(WORKERS_PAGE_LIMIT));

        const response = await fetch(`/api/objects/workers?${params.toString()}`, {
            cache: 'no-store',
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch workers (${response.status})`);
        }

        const payload = (await response.json()) as unknown;
        let pageItems: Worker[] = [];
        let total: number | undefined;

        if (Array.isArray(payload)) {
            pageItems = payload as Worker[];
        } else if (isWorkersEnvelope(payload)) {
            pageItems = payload.items;
            total = payload.total;
        } else {
            throw new Error('Unexpected workers response shape');
        }

        if (typeof total === 'number' && Number.isFinite(total)) {
            knownTotal = total;
        }

        loaded.push(...pageItems);

        if (pageItems.length < WORKERS_PAGE_LIMIT) {
            break;
        }
        if (typeof knownTotal === 'number' && loaded.length >= knownTotal) {
            break;
        }

        skip += WORKERS_PAGE_LIMIT;
        pageCount += 1;
    }

    return dedupeWorkers(loaded).sort((a, b) => a.fullname.localeCompare(b.fullname));
}

function filterTreeByQuery(
    nodes: HierarchyTreeNode[],
    query: string,
    workerMatchedOrgOids: Set<string>
): HierarchyTreeNode[] {
    if (!query.trim()) return nodes;
    const normalizedQuery = query.trim().toLowerCase();

    function filterNode(node: HierarchyTreeNode): HierarchyTreeNode | null {
        const matchesOrgName = node.name.toLowerCase().includes(normalizedQuery);
        const matchesWorkerStableId = workerMatchedOrgOids.has(node.oid);
        const childMatches = node.children
            .map((child) => filterNode(child))
            .filter((child): child is HierarchyTreeNode => child !== null);

        if (!matchesOrgName && !matchesWorkerStableId && childMatches.length === 0) {
            return null;
        }

        return {
            ...node,
            children: childMatches,
        };
    }

    return nodes
        .map((node) => filterNode(node))
        .filter((node): node is HierarchyTreeNode => node !== null);
}

function OrgTreeNode({
    node,
    level,
    expandedOrgOids,
    expandedWorkerOrgOids,
    autoExpandOrg,
    autoExpandedWorkerOrgOids,
    workersByOrg,
    loadingWorkerOrgOids,
    hasWorkerSearchMatch,
    workerSearchHitOrgOids,
    workerSearchHitOids,
    currentWorker,
    isLight,
    loadingWorkersText,
    noWorkersText,
    onToggleOrg,
    onToggleWorkers,
    onSelectWorker,
}: OrgTreeNodeProps) {
    const hasChildren = node.children.length > 0;
    const isOrgExpanded = autoExpandOrg || expandedOrgOids.has(node.oid);

    const workersAllowedForNode = hasWorkerSearchMatch
        ? workerSearchHitOrgOids.has(node.oid)
        : true;
    const isWorkersExpanded = autoExpandedWorkerOrgOids.has(node.oid) || expandedWorkerOrgOids.has(node.oid);
    const isExpanded = (hasChildren && isOrgExpanded) || (workersAllowedForNode && isWorkersExpanded);
    const isCurrentWorkerOrg = node.oid === currentWorker.org_oid;

    const workersForNode = workersByOrg.get(node.oid) ?? [];
    const isWorkersLoading = loadingWorkerOrgOids.has(node.oid);

    const handleOrgClick = () => {
        if (hasChildren) onToggleOrg(node.oid);
        if (workersAllowedForNode) onToggleWorkers(node.oid);
    };

    return (
        <div>
            <button
                onClick={handleOrgClick}
                className={`
                    w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors
                    ${isCurrentWorkerOrg
                        ? (isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-300')
                        : (isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800')}
                `}
                style={{ paddingLeft: `${(level * 14) + 8}px` }}
            >
                {(hasChildren || workersAllowedForNode) ? (
                    <span
                        className={`
                            inline-flex items-center justify-center w-4 h-4 rounded-sm
                            ${isLight ? 'text-slate-500' : 'text-slate-400'}
                        `}
                    >
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                ) : (
                    <span className="inline-flex w-4 h-4" />
                )}
                <span className={`truncate text-sm ${!node.is_active ? 'opacity-60 italic' : ''}`}>{node.name}</span>
            </button>

            {hasChildren && isOrgExpanded && (
                <div>
                    {node.children.map((child) => (
                        <OrgTreeNode
                            key={child.oid}
                            node={child}
                            level={level + 1}
                            expandedOrgOids={expandedOrgOids}
                            expandedWorkerOrgOids={expandedWorkerOrgOids}
                            autoExpandOrg={autoExpandOrg}
                            autoExpandedWorkerOrgOids={autoExpandedWorkerOrgOids}
                            workersByOrg={workersByOrg}
                            loadingWorkerOrgOids={loadingWorkerOrgOids}
                            hasWorkerSearchMatch={hasWorkerSearchMatch}
                            workerSearchHitOrgOids={workerSearchHitOrgOids}
                            workerSearchHitOids={workerSearchHitOids}
                            currentWorker={currentWorker}
                            isLight={isLight}
                            loadingWorkersText={loadingWorkersText}
                            noWorkersText={noWorkersText}
                            onToggleOrg={onToggleOrg}
                            onToggleWorkers={onToggleWorkers}
                            onSelectWorker={onSelectWorker}
                        />
                    ))}
                </div>
            )}

            {workersAllowedForNode && isWorkersExpanded && (
                <div>
                    {isWorkersLoading ? (
                        <p
                            className={`py-1.5 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}
                            style={{ paddingLeft: `${(level * 14) + 28}px`, paddingRight: '8px' }}
                        >
                            {loadingWorkersText}
                        </p>
                    ) : workersForNode.length === 0 ? (
                        <p
                            className={`py-1.5 text-xs ${isLight ? 'text-slate-500' : 'text-slate-400'}`}
                            style={{ paddingLeft: `${(level * 14) + 28}px`, paddingRight: '8px' }}
                        >
                            {noWorkersText}
                        </p>
                    ) : (
                        workersForNode.map((worker) => {
                            const isCurrent = worker.oid === currentWorker.oid;
                            const isSearchHit = workerSearchHitOids.has(worker.oid);
                            return (
                                <button
                                    key={worker.oid}
                                    onClick={() => onSelectWorker(worker.oid)}
                                    className={`
                                        w-full flex items-start gap-2 py-1.5 rounded-md text-left transition-colors
                                        ${isCurrent
                                            ? (isLight ? 'bg-blue-100 text-blue-700' : 'bg-blue-500/20 text-blue-300')
                                            : isSearchHit
                                                ? (isLight ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'bg-amber-500/20 text-amber-200 ring-1 ring-amber-500/50')
                                                : (isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-slate-800 text-slate-300')}
                                    `}
                                    style={{ paddingLeft: `${(level * 14) + 28}px`, paddingRight: '8px' }}
                                >
                                    <div className={`
                                        w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0
                                        ${isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-700 text-slate-200'}
                                    `}>
                                        {worker.fullname.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className={`text-xs font-medium truncate ${isSearchHit ? 'font-semibold' : ''}`}>{worker.fullname}</div>
                                        <div className={`text-[11px] truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {worker.stable_id}
                                        </div>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

export function PersonaOrgWorkerSidebar({ currentWorker }: PersonaOrgWorkerSidebarProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const router = useRouter();
    const t = useTranslations('Persona');

    const [query, setQuery] = useState(() => SIDEBAR_STATE_CACHE.query);
    const [expandedOrgOids, setExpandedOrgOids] = useState<Set<string>>(
        () => new Set<string>(SIDEBAR_STATE_CACHE.expandedOrgOids)
    );
    const [expandedWorkerOrgOids, setExpandedWorkerOrgOids] = useState<Set<string>>(
        () => new Set<string>(SIDEBAR_STATE_CACHE.expandedWorkerOrgOids)
    );
    const [workersByOrg, setWorkersByOrg] = useState<Map<string, Worker[]>>(
        () => new Map<string, Worker[]>(SIDEBAR_STATE_CACHE.workersByOrg)
    );
    const [loadingWorkerOrgOids, setLoadingWorkerOrgOids] = useState<Set<string>>(() => new Set<string>());
    const [workerSearchHits, setWorkerSearchHits] = useState<Worker[]>(
        () => SIDEBAR_STATE_CACHE.workerSearchQuery === SIDEBAR_STATE_CACHE.query
            ? [...SIDEBAR_STATE_CACHE.workerSearchHits]
            : []
    );

    const workersByOrgRef = useRef<Map<string, Worker[]>>(new Map<string, Worker[]>(SIDEBAR_STATE_CACHE.workersByOrg));
    const loadingWorkerOrgOidsRef = useRef<Set<string>>(new Set<string>());
    const treeScrollRef = useRef<HTMLDivElement | null>(null);

    const {
        items: organizations,
        isInitialLoading: isOrganizationsLoading,
        isLoadingMore: isOrganizationsLoadingMore,
        hasMore: hasMoreOrganizations,
        loadMore: loadMoreOrganizations,
    } = useInfiniteResource<Organization>('organizations', {
        pageSize: 1000,
        auto: true,
    });

    useEffect(() => {
        if (isOrganizationsLoading || isOrganizationsLoadingMore || !hasMoreOrganizations) return;
        void loadMoreOrganizations();
    }, [hasMoreOrganizations, isOrganizationsLoading, isOrganizationsLoadingMore, loadMoreOrganizations]);

    const organizationTree = useMemo(() => buildHierarchyTree(organizations), [organizations]);
    const normalizedQuery = query.trim().toLowerCase();

    const setWorkerSearchHitsWithCache = useCallback((searchQuery: string, hits: Worker[]) => {
        SIDEBAR_STATE_CACHE.workerSearchQuery = searchQuery;
        SIDEBAR_STATE_CACHE.workerSearchHits = [...hits];
        setWorkerSearchHits(hits);
    }, []);

    useEffect(() => {
        SIDEBAR_STATE_CACHE.query = query;
    }, [query]);

    useEffect(() => {
        SIDEBAR_STATE_CACHE.expandedOrgOids = new Set(expandedOrgOids);
    }, [expandedOrgOids]);

    useEffect(() => {
        SIDEBAR_STATE_CACHE.expandedWorkerOrgOids = new Set(expandedWorkerOrgOids);
    }, [expandedWorkerOrgOids]);

    useEffect(() => {
        SIDEBAR_STATE_CACHE.workersByOrg = new Map(workersByOrg);
        workersByOrgRef.current = new Map(workersByOrg);
    }, [workersByOrg]);

    useEffect(() => {
        const element = treeScrollRef.current;
        if (!element) return;
        element.scrollTop = SIDEBAR_STATE_CACHE.scrollTop;
    }, []);

    const ensureWorkersLoaded = useCallback(async (orgOid: string) => {
        if (workersByOrgRef.current.has(orgOid) || loadingWorkerOrgOidsRef.current.has(orgOid)) {
            return;
        }

        setLoadingWorkerOrgOids((previous) => {
            const next = new Set(previous);
            next.add(orgOid);
            loadingWorkerOrgOidsRef.current = next;
            return next;
        });

        try {
            const workers = await fetchWorkersByFilters({
                org_oid: orgOid,
                is_active: 'true',
            });

            setWorkersByOrg((previous) => {
                const next = new Map(previous);
                next.set(orgOid, workers);
                workersByOrgRef.current = next;
                return next;
            });
        } catch (error) {
            console.error(`Failed to load workers for org ${orgOid}`, error);
            setWorkersByOrg((previous) => {
                const next = new Map(previous);
                next.set(orgOid, []);
                workersByOrgRef.current = next;
                return next;
            });
        } finally {
            setLoadingWorkerOrgOids((previous) => {
                const next = new Set(previous);
                next.delete(orgOid);
                loadingWorkerOrgOidsRef.current = next;
                return next;
            });
        }
    }, []);

    useEffect(() => {
        if (!normalizedQuery) {
            setWorkerSearchHitsWithCache('', []);
            return;
        }

        let isCancelled = false;

        async function runWorkerSearch() {
            try {
                const hits = await fetchWorkersByFilters({
                    stable_id: normalizedQuery,
                    is_active: 'true',
                });

                if (isCancelled) return;
                setWorkerSearchHitsWithCache(normalizedQuery, hits);

                if (hits.length > 0) {
                    await Promise.all(hits.map((worker) => ensureWorkersLoaded(worker.org_oid)));
                }
            } catch (error) {
                if (isCancelled) return;
                console.error('Failed to search workers by stable_id', error);
                setWorkerSearchHitsWithCache(normalizedQuery, []);
            }
        }

        void runWorkerSearch();

        return () => {
            isCancelled = true;
        };
    }, [ensureWorkersLoaded, normalizedQuery, setWorkerSearchHitsWithCache]);

    useEffect(() => {
        expandedWorkerOrgOids.forEach((orgOid) => {
            void ensureWorkersLoaded(orgOid);
        });
    }, [ensureWorkersLoaded, expandedWorkerOrgOids]);

    const workerSearchHitOrgOids = useMemo(() => {
        const result = new Set<string>();
        workerSearchHits.forEach((worker) => result.add(worker.org_oid));
        return result;
    }, [workerSearchHits]);

    const workerSearchHitOids = useMemo(() => {
        const result = new Set<string>();
        workerSearchHits.forEach((worker) => result.add(worker.oid));
        return result;
    }, [workerSearchHits]);

    const filteredOrgNodes = useMemo(
        () => filterTreeByQuery(organizationTree, query, workerSearchHitOrgOids),
        [organizationTree, query, workerSearchHitOrgOids]
    );

    const hasWorkerSearchMatch = workerSearchHits.length > 0;
    const autoExpandOrg = query.trim().length > 0;

    const handleToggleOrg = (oid: string) => {
        setExpandedOrgOids((previous) => {
            const next = new Set(previous);
            if (next.has(oid)) next.delete(oid);
            else next.add(oid);
            return next;
        });
    };

    const handleToggleWorkers = (oid: string) => {
        setExpandedWorkerOrgOids((previous) => {
            const next = new Set(previous);
            if (next.has(oid)) next.delete(oid);
            else next.add(oid);
            return next;
        });
    };

    return (
        <div className={`
            h-full flex flex-col border-r
            ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-900'}
        `}>
            <div className={`p-4 border-b ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                <h2 className={`text-sm font-semibold uppercase tracking-wide ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    {t('sidebar.title')}
                </h2>
                <div className="relative mt-3">
                    <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-slate-500'}`} />
                    <input
                        type="text"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={t('sidebar.searchPlaceholder')}
                        className={`
                            w-full pl-9 pr-3 py-2 rounded-lg text-sm
                            ${isLight
                                ? 'bg-slate-100 text-slate-800 placeholder-slate-400'
                                : 'bg-slate-800 text-slate-100 placeholder-slate-500'}
                            focus:outline-none focus:ring-2 focus:ring-blue-500/50
                        `}
                    />
                </div>
            </div>

            <div className={`px-3 pt-3 pb-2 border-b ${isLight ? 'border-slate-200' : 'border-slate-700'}`}>
                <div className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    <Building2 className="w-3.5 h-3.5" />
                    {t('sidebar.organizations')}
                </div>
            </div>

            <div
                ref={treeScrollRef}
                onScroll={(event) => {
                    SIDEBAR_STATE_CACHE.scrollTop = event.currentTarget.scrollTop;
                }}
                className="flex-1 min-h-0 overflow-y-auto p-2"
            >
                {isOrganizationsLoading && organizations.length === 0 ? (
                    <p className={`px-2 py-3 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('sidebar.loadingOrganizations')}
                    </p>
                ) : filteredOrgNodes.length === 0 ? (
                    <p className={`px-2 py-3 text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('sidebar.noOrganizations')}
                    </p>
                ) : (
                    filteredOrgNodes.map((node) => (
                        <OrgTreeNode
                            key={node.oid}
                            node={node}
                            level={0}
                            expandedOrgOids={expandedOrgOids}
                            expandedWorkerOrgOids={expandedWorkerOrgOids}
                            autoExpandOrg={autoExpandOrg}
                            autoExpandedWorkerOrgOids={workerSearchHitOrgOids}
                            workersByOrg={workersByOrg}
                            loadingWorkerOrgOids={loadingWorkerOrgOids}
                            hasWorkerSearchMatch={hasWorkerSearchMatch}
                            workerSearchHitOrgOids={workerSearchHitOrgOids}
                            workerSearchHitOids={workerSearchHitOids}
                            currentWorker={currentWorker}
                            isLight={isLight}
                            loadingWorkersText={t('sidebar.loadingWorkers')}
                            noWorkersText={t('sidebar.noWorkers')}
                            onToggleOrg={handleToggleOrg}
                            onToggleWorkers={handleToggleWorkers}
                            onSelectWorker={(workerOid) => router.push(`/persona/${workerOid}`)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}
