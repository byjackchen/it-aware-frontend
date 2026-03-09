'use client';

import { useRef, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Legend } from 'recharts';
import type { ConfigItemBreakdown } from '@/lib/types/survey-analytics';
import { DrillInPopover } from './DrillInPopover';

interface ConfigItemBarProps {
    data: ConfigItemBreakdown[];
    isLight: boolean;
}

export function ConfigItemBar({ data, isLight }: ConfigItemBarProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
    const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(null);
    const isOverPopover = useRef(false);

    const chartData = data.slice(0, 12).map((item) => ({
        name: item.name.length > 25 ? item.name.slice(0, 22) + '...' : item.name,
        fullName: item.name,
        oid: item.oid,
        positive: item.semantic.positive,
        negative: item.semantic.negative,
        neutral: item.semantic.neutral,
        total: item.count,
        analyses: item.analyses,
        topLocation: item.top_locations[0]
            ? `${item.top_locations[0].location_name} (${item.top_locations[0].percentage}%)`
            : '',
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleBarClick = (entry: any) => {
        if (entry?.oid) window.open(`/data/service-catalogs/${entry.oid}`, '_blank');
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleMouseEnter = useCallback((entry: any, _index: number, e: React.MouseEvent) => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        const oid = entry?.oid ?? entry?.payload?.oid;
        const idx = oid ? chartData.findIndex((d) => d.oid === oid) : _index;
        setHoveredIndex(idx >= 0 ? idx : _index);
        setPopoverPos({ x: e.clientX + 16, y: e.clientY - 20 });
    }, [chartData]);

    const handleMouseLeave = useCallback(() => {
        hoverTimeout.current = setTimeout(() => {
            if (!isOverPopover.current) setHoveredIndex(null);
        }, 150);
    }, []);

    const hoveredItem = hoveredIndex !== null ? chartData[hoveredIndex] : null;
    const origItem = hoveredIndex !== null ? data[hoveredIndex] : null;

    return (
        <div className="relative">
            <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 32)}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                    <XAxis type="number" tick={{ fill: isLight ? '#64748b' : '#94a3b8', fontSize: 11 }} axisLine={{ stroke: isLight ? '#e2e8f0' : 'rgba(255,255,255,0.1)' }} />
                    <YAxis type="category" dataKey="name" width={160} tick={{ fill: isLight ? '#334155' : '#e2e8f0', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Legend
                        verticalAlign="top"
                        height={30}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(value: any) => (
                            <span style={{ color: isLight ? '#475569' : '#94a3b8', fontSize: '12px' }}>{value}</span>
                        )}
                    />
                    <Bar dataKey="positive" stackId="a" fill="#22c55e" name="Positive" cursor="pointer" onClick={handleBarClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
                    <Bar dataKey="negative" stackId="a" fill="#ef4444" name="Negative" cursor="pointer" onClick={handleBarClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
                    <Bar dataKey="neutral" stackId="a" fill="#94a3b8" name="Neutral" radius={[0, 4, 4, 0]} cursor="pointer" onClick={handleBarClick} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} />
                </BarChart>
            </ResponsiveContainer>

            {hoveredItem && origItem && (
                <DrillInPopover
                    title={hoveredItem.fullName}
                    analyses={origItem.analyses}
                    totalCount={origItem.count}
                    isLight={isLight}
                    position={popoverPos}
                    onMouseEnter={() => { isOverPopover.current = true; }}
                    onMouseLeave={() => { isOverPopover.current = false; setHoveredIndex(null); }}
                />
            )}
        </div>
    );
}
