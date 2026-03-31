'use client';

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { useTranslations } from 'next-intl';

export interface NegativeBarItem {
    oid: string;
    name: string;
    negativeCount: number;
}

interface NegativeBarProps {
    data: NegativeBarItem[];
    isLight: boolean;
    hoveredIndex: number | null;
    onHover: (index: number | null) => void;
}

export function NegativeBar({ data, isLight, hoveredIndex, onHover }: NegativeBarProps) {
    const t = useTranslations('SurveyAnalytics');

    const chartData = data.map((item) => ({
        name: item.name.length > 25 ? item.name.slice(0, 22) + '...' : item.name,
        fullName: item.name,
        oid: item.oid,
        negative: item.negativeCount,
    }));

    const handleBarClick = (entry: { oid?: string }) => {
        if (entry?.oid) window.open(`/data/service-catalogs/${entry.oid}`, '_blank');
    };

    return (
        <div>
            <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 36)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <XAxis
                        type="number"
                        tick={{ fill: isLight ? '#64748b' : '#94a3b8', fontSize: 11 }}
                        axisLine={{ stroke: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        tick={{ fill: isLight ? '#334155' : '#e2e8f0', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Bar
                        dataKey="negative"
                        name={t('classification.negative')}
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={(entry) => handleBarClick(entry as { oid?: string })}
                        onMouseEnter={(_, index) => onHover(index)}
                        onMouseLeave={() => onHover(null)}
                    >
                        {chartData.map((_, index) => (
                            <Cell
                                key={index}
                                fill={hoveredIndex === index ? '#dc2626' : '#ef4444'}
                                opacity={hoveredIndex !== null && hoveredIndex !== index ? 0.4 : 1}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
