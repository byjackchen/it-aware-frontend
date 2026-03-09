'use client';

import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { GeoDistributionItem } from '@/lib/types/survey-analytics';

interface GeoDistributionBarProps {
    data: GeoDistributionItem[];
    isLight: boolean;
}

export function GeoDistributionBar({ data, isLight }: GeoDistributionBarProps) {
    const router = useRouter();
    const chartData = data.slice(0, 15).map((item) => ({
        ...item,
        name: item.location_name.length > 25
            ? item.location_name.slice(0, 22) + '...'
            : item.location_name,
        fullName: item.location_name,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBarClick = (entry: any) => {
        if (entry?.location_oid) {
            router.push(`/data/locations/${entry.location_oid}`);
        }
    };

    return (
        <ResponsiveContainer width="100%" height={Math.max(240, chartData.length * 32)}>
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
    );
}
