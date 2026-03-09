'use client';

import { useRouter } from 'next/navigation';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { SubmissionStatusCounts } from '@/lib/types/survey-analytics';

interface ResponseRateDonutProps {
    statusCounts: SubmissionStatusCounts;
    isLight: boolean;
    batchOid: string;
}

const COLORS: Record<string, string> = {
    submitted: '#22c55e',
    not_started: '#94a3b8',
    revoked: '#f59e0b',
    expired: '#ef4444',
};

const LABELS: Record<string, string> = {
    submitted: 'Submitted',
    not_started: 'Not Started',
    revoked: 'Revoked',
    expired: 'Expired',
};

export function ResponseRateDonut({ statusCounts, isLight, batchOid }: ResponseRateDonutProps) {
    const router = useRouter();
    const data = Object.entries(statusCounts)
        .filter(([key]) => key !== 'total')
        .filter(([, value]) => value > 0)
        .map(([key, value]) => ({
            name: LABELS[key] ?? key,
            value,
            color: COLORS[key] ?? '#6b7280',
        }));

    const handlePieClick = () => {
        router.push(`/data/surveys`);
    };

    return (
        <ResponsiveContainer width="100%" height={240}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    cursor="pointer"
                    onClick={handlePieClick}
                >
                    {data.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{
                        backgroundColor: isLight ? '#fff' : '#1e293b',
                        border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: isLight ? '#1e293b' : '#f1f5f9',
                    }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => [Number(value).toLocaleString(), '']}
                />
                <Legend
                    verticalAlign="bottom"
                    height={36}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(value: any) => (
                        <span style={{ color: isLight ? '#475569' : '#94a3b8', fontSize: '12px' }}>{value}</span>
                    )}
                />
            </PieChart>
        </ResponsiveContainer>
    );
}
