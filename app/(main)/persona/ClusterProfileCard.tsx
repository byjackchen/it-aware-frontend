'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Network, Clock, ArrowRight, Tag } from 'lucide-react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import type { Worker, WorkerCluster, ClusterSummaryResponse } from '@/lib/types/objects';
import { FEATURE_LABELS } from '@/lib/utils/cluster-feature-labels';

interface ClusterProfileCardProps {
    currentWorker: Worker;
    workerCluster: WorkerCluster | null;
    clusterSummary: ClusterSummaryResponse | null;
    isLight: boolean;
    cardClass: string;
    sectionTitleClass: string;
    labelClass: string;
    valueClass: string;
}

export function ClusterProfileCard({
    currentWorker,
    workerCluster,
    clusterSummary,
    isLight,
    cardClass,
    sectionTitleClass,
    labelClass,
    valueClass,
}: ClusterProfileCardProps) {
    const t = useTranslations('Persona');
    const locale = useLocale();
    const profile = workerCluster?.cluster_profile ?? null;

    // Label features: from cluster data if available, otherwise derive from Worker
    const labelFeatures = useMemo(() => {
        if (workerCluster?.label_features) {
            return workerCluster.label_features;
        }
        // Fallback: derive from Worker object
        return {
            is_vip: currentWorker.is_vip ? 1 : 0,
        };
    }, [workerCluster?.label_features, currentWorker.is_vip]);

    const clusterSize = useMemo(() => {
        if (!clusterSummary || !workerCluster) return null;
        const info = clusterSummary.clusters.find(
            (c) => c.cluster_label === workerCluster.cluster_label,
        );
        return info?.size ?? null;
    }, [clusterSummary, workerCluster]);

    const radarData = useMemo(() => {
        if (!workerCluster?.behavior_features) return [];
        const bf = workerCluster.behavior_features;
        const bs = workerCluster.behavior_scales;

        const entries = Object.entries(bf).map(([key, raw]) => {
            const param = bs?.[key];
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
    }, [workerCluster?.behavior_features, workerCluster?.behavior_scales, locale]);

    const hasClustering = workerCluster && workerCluster.cluster_label !== -1;

    return (
        <section className={cardClass}>
            <div className="flex items-center gap-2 mb-4">
                <Network className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-slate-300'}`} />
                <h2 className={sectionTitleClass}>{t('cluster.profile')}</h2>
            </div>

            {/* Label Features — always shown */}
            <div className="mb-5">
                <div className={`${labelClass} mb-2`}>
                    <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3" />
                        {t('cluster.labelFeatures')}
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(labelFeatures).map(([key, value]) => {
                        const fl = FEATURE_LABELS[key];
                        const featureName = fl ? (locale === 'zh' ? fl.zh : fl.en) : key;
                        const isActive = value >= 1;
                        return (
                            <span
                                key={key}
                                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                    isActive
                                        ? (isLight
                                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                            : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30')
                                        : (isLight
                                            ? 'bg-slate-50 text-slate-400 border-slate-200'
                                            : 'bg-slate-800 text-slate-500 border-slate-700')
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isActive ? 'bg-indigo-500' : (isLight ? 'bg-slate-300' : 'bg-slate-600')}`} />
                                {featureName}
                                <span className="ml-1.5 opacity-70">{isActive ? 'Yes' : 'No'}</span>
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Divider */}
            <div className={`border-t mb-5 ${isLight ? 'border-slate-100' : 'border-slate-800'}`} />

            {/* Behavior Clustering — conditional */}
            {!hasClustering ? (
                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('cluster.noCluster')}
                </p>
            ) : (
                <>
                    {profile ? (
                        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                            {/* Left column: profile text */}
                            <div className="xl:col-span-3 space-y-4">
                                <div>
                                    <div className={labelClass}>{t('cluster.description')}</div>
                                    <div className={`${valueClass} whitespace-pre-wrap`}>{profile.description}</div>
                                </div>

                                <div>
                                    <div className={labelClass}>{t('cluster.behaviors')}</div>
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
                                    <div className={labelClass}>{t('cluster.painPoints')}</div>
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
                                    <div className={labelClass}>{t('cluster.bestPractices')}</div>
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
                                    <div className={labelClass}>{t('cluster.sla')}</div>
                                    <div className={`${valueClass} flex items-center gap-1.5`}>
                                        <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                        {profile.sla_recommendation}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    {clusterSize !== null && (
                                        <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                            {t('cluster.basedOn', { count: clusterSize })}
                                        </span>
                                    )}
                                    <Link
                                        href={`/data/clusters/${workerCluster.cluster_label}`}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors"
                                    >
                                        {t('cluster.viewCluster')}
                                        <ArrowRight className="w-3 h-3" />
                                    </Link>
                                </div>
                            </div>

                            {/* Right column: radar chart */}
                            {radarData.length > 0 && (
                                <div className="xl:col-span-2">
                                    <div className={`${labelClass} mb-2`}>{t('cluster.features')}</div>
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
                                                    border: isLight
                                                        ? '1px solid #e2e8f0'
                                                        : '1px solid rgba(255,255,255,0.1)',
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
                    ) : (
                        <div className="flex items-center justify-end">
                            <Link
                                href={`/data/clusters/${workerCluster.cluster_label}`}
                                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-500 hover:text-indigo-600 transition-colors"
                            >
                                {t('cluster.viewCluster')}
                                <ArrowRight className="w-3 h-3" />
                            </Link>
                        </div>
                    )}
                </>
            )}
        </section>
    );
}
