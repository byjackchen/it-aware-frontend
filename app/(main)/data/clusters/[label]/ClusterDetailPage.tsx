'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { ArrowLeft, Network, Clock, Loader2 } from 'lucide-react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import { FEATURE_LABELS } from '@/lib/utils/cluster-feature-labels';
import type {
    ClusterInfo,
    ClusterSummaryResponse,
    WorkerCluster,
    WorkerClusterListResponse,
    Worker,
} from '@/lib/types/objects';

const PAGE_SIZE = 1000;

const CLUSTER_COLORS: Record<number, string> = {
    [-1]: 'bg-slate-400',
    0: 'bg-indigo-500',
    1: 'bg-emerald-500',
    2: 'bg-amber-500',
    3: 'bg-rose-500',
    4: 'bg-cyan-500',
    5: 'bg-violet-500',
};

function getClusterColor(label: number): string {
    return CLUSTER_COLORS[label] || 'bg-slate-400';
}

interface WorkerListResponse {
    items: Worker[];
    total: number;
}

interface ClusterDetailPageProps {
    clusterLabel: number;
    clusterInfo: ClusterInfo | null;
    summary: ClusterSummaryResponse;
    initialAssignments: WorkerCluster[];
    totalAssignments: number;
}

export function ClusterDetailPage({
    clusterLabel,
    clusterInfo,
    summary,
    initialAssignments,
    totalAssignments,
}: ClusterDetailPageProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useTransitionRouter();
    const t = useTranslations('Data.clusters');
    const tPersona = useTranslations('Persona.cluster');
    const locale = useLocale();
    const isLight = theme === 'light';

    const [assignments, setAssignments] = useState<WorkerCluster[]>(initialAssignments);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [workerMap, setWorkerMap] = useState<Record<string, { name: string; stableId: string }>>({});

    const profile = clusterInfo?.cluster_profile ?? null;
    const clusterName = clusterInfo?.cluster_name ?? (clusterLabel === -1 ? t('noise') : `Cluster ${clusterLabel}`);

    const cardClass = `rounded-xl border p-5 ${isLight ? 'border-slate-200 bg-white' : 'border-slate-700 bg-slate-900'}`;
    const labelClass = `text-xs uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`;
    const valueClass = `text-sm font-medium ${isLight ? 'text-slate-700' : 'text-slate-200'}`;
    const sectionTitleClass = `text-base font-semibold ${isLight ? 'text-slate-800' : 'text-slate-100'}`;

    // Fetch worker name map
    useEffect(() => {
        async function fetchWorkers() {
            try {
                const map: Record<string, { name: string; stableId: string }> = {};
                let skip = 0;
                // eslint-disable-next-line no-constant-condition
                while (true) {
                    const res = await fetch(`/api/objects/workers?limit=${PAGE_SIZE}&skip=${skip}`);
                    if (!res.ok) break;
                    const data: WorkerListResponse = await res.json();
                    for (const w of data.items || []) {
                        map[w.oid] = { name: w.fullname, stableId: w.stable_id };
                    }
                    if (Object.keys(map).length >= data.total || (data.items?.length ?? 0) < PAGE_SIZE) break;
                    skip += PAGE_SIZE;
                }
                setWorkerMap(map);
            } catch { /* ignore */ }
        }
        void fetchWorkers();
    }, []);

    // Load remaining assignments
    const loadMore = useCallback(async () => {
        if (assignments.length >= totalAssignments || isLoadingMore) return;
        setIsLoadingMore(true);
        try {
            const params = new URLSearchParams({
                limit: String(PAGE_SIZE),
                skip: String(assignments.length),
                cluster_label: String(clusterLabel),
            });
            const res = await fetch(`/api/objects/worker-clusters?${params}`);
            if (!res.ok) return;
            const data: WorkerClusterListResponse = await res.json();
            setAssignments((prev) => [...prev, ...(data.items || [])]);
        } catch { /* ignore */ } finally {
            setIsLoadingMore(false);
        }
    }, [assignments.length, totalAssignments, isLoadingMore, clusterLabel]);

    // Auto-load all on mount
    useEffect(() => {
        if (assignments.length < totalAssignments) {
            void loadMore();
        }
    }, [assignments.length, totalAssignments, loadMore]);

    // Compute average behavior features and get shared behavior_scales for z-score radar
    const { avgBehaviorFeatures, behaviorScales } = useMemo(() => {
        const withFeatures = assignments.filter((a) => a.behavior_features);
        if (withFeatures.length === 0) return { avgBehaviorFeatures: null, behaviorScales: null };
        const sums: Record<string, number> = {};
        const counts: Record<string, number> = {};
        for (const a of withFeatures) {
            for (const [k, v] of Object.entries(a.behavior_features!)) {
                sums[k] = (sums[k] || 0) + v;
                counts[k] = (counts[k] || 0) + 1;
            }
        }
        const avg: Record<string, number> = {};
        for (const k of Object.keys(sums)) {
            avg[k] = sums[k] / counts[k];
        }
        // Use behavior_scales from first assignment (shared across all workers in a run)
        const bs = withFeatures[0]?.behavior_scales ?? null;
        return { avgBehaviorFeatures: avg, behaviorScales: bs };
    }, [assignments]);

    const radarData = useMemo(() => {
        if (!avgBehaviorFeatures) return [];

        const entries = Object.entries(avgBehaviorFeatures).map(([key, raw]) => {
            const param = behaviorScales?.[key];
            const z = param && param.scale > 0 ? (raw - param.mean) / param.scale : 0;
            return { key, raw, z, absZ: Math.abs(z) };
        });

        const top = entries.sort((a, b) => b.absZ - a.absZ).slice(0, 10);

        return top.map(({ key, raw, absZ }) => {
            const fl = FEATURE_LABELS[key];
            return {
                feature: fl ? (locale === 'zh' ? fl.zh : fl.en) : key,
                normalized: absZ,
                rawValue: raw,
            };
        });
    }, [avgBehaviorFeatures, behaviorScales, locale]);

    return (
        <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/data/clusters')}
                        className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-400'}`}>
                        <Network className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${getClusterColor(clusterLabel)}`} />
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                {clusterName}
                            </h1>
                        </div>
                        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            {clusterInfo ? `${clusterInfo.size.toLocaleString()} ${t('workers')} (${clusterInfo.percentage.toFixed(1)}%)` : `${totalAssignments.toLocaleString()} ${t('workers')}`}
                        </p>
                    </div>
                </div>

                {/* Profile card */}
                {profile && (
                    <section className={cardClass}>
                        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                            {/* Left: profile text */}
                            <div className="xl:col-span-3 space-y-4">
                                <div>
                                    <div className={labelClass}>{tPersona('description')}</div>
                                    <div className={`${valueClass} whitespace-pre-wrap`}>{profile.description}</div>
                                </div>

                                <div>
                                    <div className={labelClass}>{tPersona('behaviors')}</div>
                                    <ul className="space-y-1 mt-1">
                                        {(profile.key_behaviors ?? []).map((b, i) => (
                                            <li key={i} className={`text-sm flex items-start gap-2 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                                {b}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div>
                                    <div className={labelClass}>{tPersona('painPoints')}</div>
                                    <ul className="space-y-1 mt-1">
                                        {(profile.pain_points ?? []).map((p, i) => (
                                            <li key={i} className={`text-sm flex items-start gap-2 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                                {p}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div>
                                    <div className={labelClass}>{tPersona('bestPractices')}</div>
                                    <ul className="space-y-1 mt-1">
                                        {(profile.best_practices ?? []).map((bp, i) => (
                                            <li key={i} className={`text-sm flex items-start gap-2 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>
                                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                                {bp}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div>
                                    <div className={labelClass}>{tPersona('sla')}</div>
                                    <div className={`${valueClass} flex items-center gap-1.5`}>
                                        <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                        {profile.sla_recommendation}
                                    </div>
                                </div>
                            </div>

                            {/* Right: radar chart */}
                            {radarData.length > 0 && (
                                <div className="xl:col-span-2">
                                    <div className={`${labelClass} mb-2`}>{t('featureRadar')}</div>
                                    <ResponsiveContainer width="100%" height={280}>
                                        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                                            <PolarGrid stroke={isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)'} />
                                            <PolarAngleAxis
                                                dataKey="feature"
                                                tick={{ fill: isLight ? '#64748b' : '#94a3b8', fontSize: 10 }}
                                            />
                                            <PolarRadiusAxis
                                                domain={[0, Math.ceil(Math.max(...radarData.map((d) => d.normalized), 1))]}
                                                tick={{ fill: isLight ? '#94a3b8' : '#64748b', fontSize: 9 }}
                                                axisLine={false}
                                            />
                                            <Radar
                                                name="Z-Score"
                                                dataKey="normalized"
                                                stroke="#6366f1"
                                                fill="#6366f1"
                                                fillOpacity={0.15}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: isLight ? '#fff' : '#1e293b',
                                                    border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '8px',
                                                    color: isLight ? '#1e293b' : '#f1f5f9',
                                                    fontSize: 12,
                                                }}
                                                formatter={(_val, _name, props) => {
                                                    const p = props as { payload?: { rawValue?: number; normalized?: number } };
                                                    const raw = p.payload?.rawValue;
                                                    const z = p.payload?.normalized;
                                                    const label = raw !== undefined ? `${raw.toFixed(2)} (${z !== undefined ? z.toFixed(1) : '—'}σ)` : '—';
                                                    return [label, 'Value'];
                                                }}
                                            />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </div>

                        {/* Stats footer */}
                        <div className={`grid grid-cols-2 xl:grid-cols-4 gap-4 mt-5 pt-4 border-t ${isLight ? 'border-slate-100' : 'border-slate-800'}`}>
                            <div>
                                <div className={labelClass}>{t('clusterSize')}</div>
                                <div className={valueClass}>{clusterInfo?.size?.toLocaleString() ?? totalAssignments.toLocaleString()}</div>
                            </div>
                            <div>
                                <div className={labelClass}>{t('percentage')}</div>
                                <div className={valueClass}>{clusterInfo?.percentage?.toFixed(1) ?? '—'}%</div>
                            </div>
                            <div>
                                <div className={labelClass}>{t('runId')}</div>
                                <div className={`${valueClass} truncate`}>{summary.run_id ?? '—'}</div>
                            </div>
                            <div>
                                <div className={labelClass}>{t('computedAt')}</div>
                                <div className={valueClass}>{summary.computed_at ? formatDateTime(summary.computed_at, timezone) : '—'}</div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Workers list */}
                <section className={cardClass}>
                    <div className="flex items-center gap-2 mb-4">
                        <h2 className={sectionTitleClass}>{t('workers')} ({assignments.length.toLocaleString()})</h2>
                    </div>
                    <div className={`rounded-lg border overflow-hidden ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
                        {assignments.length === 0 ? (
                            <div className={`py-8 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('noWorkers')}</div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-white/5">
                                {assignments.map((a) => {
                                    const worker = workerMap[a.worker_oid];
                                    return (
                                        <button
                                            key={a.worker_oid}
                                            onClick={() => router.push(`/persona/${a.worker_oid}`)}
                                            className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                    {worker?.name || a.worker_oid}
                                                </div>
                                                <div className={`text-xs truncate ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                    {worker?.stableId || ''}
                                                </div>
                                            </div>
                                            <div className={`text-xs ml-4 shrink-0 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                                {t('probability')}: {(a.cluster_probability * 100).toFixed(0)}%
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    {isLoadingMore && (
                        <div className={`mt-3 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2 text-sm"><Loader2 className="w-3 h-3 animate-spin" /> Loading more workers...</span>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
}
