'use client';

import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { GeoDistributionItem } from '@/lib/types/survey-analytics';

interface GeoDistributionBarProps {
    data: GeoDistributionItem[];
    isLight: boolean;
    defaultVisible?: number;
}

export function GeoDistributionBar({ data, isLight, defaultVisible = 5 }: GeoDistributionBarProps) {
    const t = useTranslations('SurveyAnalytics');
    const [expanded, setExpanded] = useState(false);
    const hasMore = data.length > defaultVisible;
    const visibleData = expanded ? data.slice(0, 20) : data.slice(0, defaultVisible);

    const chartData = visibleData.map((item) => ({
        ...item,
        name: item.location_name.length > 25
            ? item.location_name.slice(0, 22) + '...'
            : item.location_name,
        fullName: item.location_name,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBarClick = (entry: any) => {
        if (entry?.location_oid) {
            window.open(`/data/locations/${entry.location_oid}`, '_blank');
        }
    };

    const REGION_COLORS: Record<string, { color: string; label: string }> = {
        APAC: { color: '#3b82f6', label: t('region.apac') },
        EMEA: { color: '#8b5cf6', label: t('region.emea') },
        Americas: { color: '#f59e0b', label: t('region.americas') },
    };

    const activeRegions = [...new Set(data.map((d) => d.region))];

    return (
        <div>
            <div className="flex items-center gap-3 mb-2">
                {activeRegions.map((region) => {
                    const rc = REGION_COLORS[region] ?? { color: '#6b7280', label: region };
                    return (
                        <span key={region} className="flex items-center gap-1.5 text-xs">
                            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: rc.color }} />
                            <span className={isLight ? 'text-slate-600' : 'text-gray-400'}>{rc.label}</span>
                        </span>
                    );
                })}
            </div>
            <ResponsiveContainer width="100%" height={Math.max(140, chartData.length * 32)}>
                <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                >
                    <XAxis
                        type="number"
                        tick={{ fill: isLight ? '#64748b' : '#94a3b8', fontSize: 11 }}
                        axisLine={{ stroke: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        width={160}
                        tick={{ fill: isLight ? '#334155' : '#e2e8f0', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: isLight ? '#fff' : '#1e293b',
                            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: isLight ? '#1e293b' : '#f1f5f9',
                        }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any, _name: any, props: any) => {
                            const p = props?.payload;
                            if (!p) return [value, ''];
                            return [`${value} / ${p.total_count} (${p.response_rate}%)`, p.fullName];
                        }}
                    />
                    <Bar
                        dataKey="submitted_count"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={handleBarClick}
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={index} fill={entry.region === 'APAC' ? '#3b82f6' : entry.region === 'EMEA' ? '#8b5cf6' : entry.region === 'Americas' ? '#f59e0b' : '#6b7280'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            {hasMore && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className={`w-full flex items-center justify-center gap-1 py-1.5 text-xs font-medium rounded-lg mt-1 transition-colors ${
                        isLight
                            ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                >
                    {expanded ? (
                        <>{t('submission.showLess')} <ChevronUp className="w-3.5 h-3.5" /></>
                    ) : (
                        <>{t('submission.showAll', { count: data.length })} <ChevronDown className="w-3.5 h-3.5" /></>
                    )}
                </button>
            )}
        </div>
    );
}
