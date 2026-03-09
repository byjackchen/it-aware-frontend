'use client';

import { useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { IntentSummaryItem } from '@/lib/types/survey-analytics';
import { DrillInPopover } from './DrillInPopover';

interface IntentBreakdownBarProps {
    data: IntentSummaryItem[];
    isLight: boolean;
    batchOid: string;
}

const INTENT_COLORS: Record<string, string> = {
    praise: '#22c55e',
    bug: '#ef4444',
    complaint: '#f59e0b',
    suggestion: '#8b5cf6',
    request: '#3b82f6',
};

export function IntentBreakdownBar({ data, isLight, batchOid }: IntentBreakdownBarProps) {
    const router = useRouter();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
    const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(null);
    const isOverPopover = useRef(false);

    const chartData = data.map((item) => ({
        name: item.intent.charAt(0).toUpperCase() + item.intent.slice(1),
        count: item.count,
        percentage: item.percentage,
        intent: item.intent,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBarClick = (entry: any) => {
        if (entry?.intent) router.push(`/data/analyses?source_batch_oid=${batchOid}`);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseEnter = useCallback((_: any, index: number, e: React.MouseEvent) => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        setHoveredIndex(index);
        setPopoverPos({ x: e.clientX + 16, y: e.clientY - 20 });
    }, []);

    const handleMouseLeave = useCallback(() => {
        hoverTimeout.current = setTimeout(() => {
            if (!isOverPopover.current) setHoveredIndex(null);
        }, 150);
    }, []);

    const hoveredItem = hoveredIndex !== null ? data[hoveredIndex] : null;

    return (
        <div className="relative">
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fill: isLight ? '#334155' : '#e2e8f0', fontSize: 12 }} axisLine={{ stroke: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }} />
                    <YAxis tick={{ fill: isLight ? '#64748b' : '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: isLight ? '#fff' : '#1e293b',
                            border: isLight ? '1px solid #e2e8f0' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            color: isLight ? '#1e293b' : '#f1f5f9',
                        }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any, _name: any, props: any) => [
                            `${value} (${props?.payload?.percentage ?? 0}%)`,
                            'Count',
                        ]}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
                        {chartData.map((entry, index) => (
                            <Cell key={index} fill={INTENT_COLORS[entry.intent] ?? '#6b7280'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {hoveredItem && (
                <DrillInPopover
                    title={hoveredItem.intent.charAt(0).toUpperCase() + hoveredItem.intent.slice(1)}
                    analyses={hoveredItem.analyses}
                    totalCount={hoveredItem.count}
                    isLight={isLight}
                    position={popoverPos}
                    onMouseEnter={() => { isOverPopover.current = true; }}
                    onMouseLeave={() => { isOverPopover.current = false; setHoveredIndex(null); }}
                />
            )}
        </div>
    );
}
