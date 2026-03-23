'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Network, Clock, ArrowRight } from 'lucide-react';
import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';
import type { WorkerCluster, ClusterSummaryResponse } from '@/lib/types/objects';
import { FEATURE_LABELS } from '@/lib/utils/cluster-feature-labels';

interface ClusterProfileCardProps {
    workerCluster: WorkerCluster;
    clusterSummary: ClusterSummaryResponse | null;
    isLight: boolean;
    cardClass: string;
    sectionTitleClass: string;
    labelClass: string;
    valueClass: string;
}

export function ClusterProfileCard({
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
    const profile = workerCluster.cluster_profile;

    const clusterSize = useMemo(() => {
        if (!clusterSummary) return null;
        const info = clusterSummary.clusters.find(
            (c) => c.cluster_label === workerCluster.cluster_label,
        );
        return info?.size ?? null;
    }, [clusterSummary, workerCluster.cluster_label]);

    const radarData = useMemo(() => {
        if (!workerCluster.feature_vector) return [];
        return Object.entries(workerCluster.feature_vector)
            .map(([key, value]) => ({ key, absValue: Math.abs(value), value }))
            .sort((a, b) => b.absValue - a.absValue)
            .slice(0, 10)
            .map(({ key, value }) => {
                const label = FEATURE_LABELS[key];
                return {
                    feature: label ? (locale === 'zh' ? label.zh : label.en) : key,
                    value,
                };
            });
    }, [workerCluster.feature_vector, locale]);

    const radarMax = useMemo(() => {
        if (radarData.length === 0) return 5;
        return Math.max(...radarData.map((d) => Math.abs(d.value))) * 1.3;
    }, [radarData]);

    return (
        <section className={cardClass}>
            <div className="flex items-center gap-2 mb-4">
                <Network className={`w-4 h-4 ${isLight ? 'text-slate-600' : 'text-slate-300'}`} />
                <h2 className={sectionTitleClass}>{t('cluster.profile')}</h2>
            </div>

            {!profile ? (
                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                    {t('cluster.noCluster')}
                </p>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                    {/* Left column: profile text */}
                    <div className="xl:col-span-3 space-y-4">
                        {/* Description */}
                        <div>
                            <div className={labelClass}>{t('cluster.description')}</div>
                            <div className={`${valueClass} whitespace-pre-wrap`}>{profile.description}</div>
                        </div>

                        {/* Key Behaviors */}
                        <div>
                            <div className={labelClass}>{t('cluster.behaviors')}</div>
                            <ul className="space-y-1 mt-1">
                                {profile.key_behaviors.map((b, i) => (
                                    <li
                                        key={i}
                                        className={`text-sm flex items-start gap-2 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
                                    >
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                        {b}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Pain Points */}
                        <div>
                            <div className={labelClass}>{t('cluster.painPoints')}</div>
                            <ul className="space-y-1 mt-1">
                                {profile.pain_points.map((p, i) => (
                                    <li
                                        key={i}
                                        className={`text-sm flex items-start gap-2 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
                                    >
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                                        {p}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Best Practices */}
                        <div>
                            <div className={labelClass}>{t('cluster.bestPractices')}</div>
                            <ul className="space-y-1 mt-1">
                                {profile.best_practices.map((bp, i) => (
                                    <li
                                        key={i}
                                        className={`text-sm flex items-start gap-2 ${isLight ? 'text-slate-700' : 'text-slate-200'}`}
                                    >
                                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                                        {bp}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* SLA Recommendation */}
                        <div>
                            <div className={labelClass}>{t('cluster.sla')}</div>
                            <div className={`${valueClass} flex items-center gap-1.5`}>
                                <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                {profile.sla_recommendation}
                            </div>
                        </div>

                        {/* Footer: based on N workers + link */}
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
                                        domain={[0, radarMax]}
                                        tick={{ fill: isLight ? '#94a3b8' : '#64748b', fontSize: 9 }}
                                        axisLine={false}
                                    />
                                    <Radar
                                        name="Feature Value"
                                        dataKey="value"
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
                                    />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
