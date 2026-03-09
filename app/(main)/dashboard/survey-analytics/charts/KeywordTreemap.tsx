'use client';

import { useRef, useState, useCallback } from 'react';
import { Treemap, ResponsiveContainer } from 'recharts';
import type { KeywordItem } from '@/lib/types/survey-analytics';
import { DrillInPopover } from './DrillInPopover';

interface KeywordTreemapProps {
    keywords: KeywordItem[];
    isLight: boolean;
}

function getSentimentColor(item: KeywordItem): string {
    const total = item.positive_count + item.negative_count + item.neutral_count;
    if (total === 0) return '#94a3b8';

    const posRatio = item.positive_count / total;
    const negRatio = item.negative_count / total;

    if (posRatio > 0.6) return '#22c55e';
    if (posRatio > 0.4 && negRatio < 0.3) return '#86efac';
    if (negRatio > 0.6) return '#ef4444';
    if (negRatio > 0.4 && posRatio < 0.3) return '#fca5a5';
    return '#94a3b8';
}

interface TreemapContentProps {
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
    fill: string;
    isLight: boolean;
    positiveCount: number;
    negativeCount: number;
    onClick?: () => void;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: () => void;
}

function CustomTreemapContent({ x, y, width, height, name, fill, isLight, positiveCount, negativeCount, onClick, onMouseEnter, onMouseLeave }: TreemapContentProps) {
    if (width < 30 || height < 20) return null;

    const fontSize = Math.min(12, Math.max(9, Math.min(width / (name.length * 0.7), height / 3)));
    const showLabel = width > 40 && height > 20;
    const showCounts = width > 60 && height > 40;
    const countFontSize = Math.min(9, Math.max(7, fontSize - 2));

    return (
        <g onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} style={{ cursor: 'pointer' }}>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={fill}
                stroke={isLight ? '#fff' : '#0f172a'}
                strokeWidth={2}
                rx={4}
                opacity={0.85}
            />
            {showLabel && (
                <text
                    x={x + width / 2}
                    y={y + (showCounts ? height / 2 - 6 : height / 2)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={isLight ? '#1e293b' : '#fff'}
                    fontSize={fontSize}
                    fontWeight={500}
                >
                    {name.length > width / (fontSize * 0.6) ? name.slice(0, Math.floor(width / (fontSize * 0.6))) + '...' : name}
                </text>
            )}
            {showCounts && (
                <text
                    x={x + width / 2}
                    y={y + height - 8}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.7)"
                    fontSize={countFontSize}
                    fontWeight={400}
                >
                    <tspan fill="#86efac">+{positiveCount}</tspan>
                    <tspan>{' '}</tspan>
                    <tspan fill="#fca5a5">-{negativeCount}</tspan>
                </text>
            )}
        </g>
    );
}

export function KeywordTreemap({ keywords, isLight }: KeywordTreemapProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
    const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(null);
    const isOverPopover = useRef(false);

    const treemapData = keywords.slice(0, 50).map((kw) => ({
        name: kw.keyword,
        size: kw.total_count,
        fill: getSentimentColor(kw),
        ...kw,
    }));

    const handleCellMouseEnter = useCallback((index: number, e: React.MouseEvent) => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        setHoveredIndex(index);
        setPopoverPos({ x: e.clientX + 16, y: e.clientY - 20 });
    }, []);

    const handleCellMouseLeave = useCallback(() => {
        hoverTimeout.current = setTimeout(() => {
            if (!isOverPopover.current) setHoveredIndex(null);
        }, 150);
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderContent = (props: any) => {
        const { x, y, width, height, name, fill, index } = props;
        const kw = treemapData[index];
        return (
            <CustomTreemapContent
                x={x}
                y={y}
                width={width}
                height={height}
                name={name}
                fill={fill}
                isLight={isLight}
                positiveCount={kw?.positive_count ?? 0}
                negativeCount={kw?.negative_count ?? 0}
                onMouseEnter={(e) => handleCellMouseEnter(index, e)}
                onMouseLeave={handleCellMouseLeave}
            />
        );
    };

    const hoveredKw = hoveredIndex !== null ? keywords[hoveredIndex] : null;

    return (
        <div className="relative">
            <ResponsiveContainer width="100%" height={400}>
                <Treemap
                    data={treemapData}
                    dataKey="size"
                    stroke="none"
                    content={renderContent}
                />
            </ResponsiveContainer>

            {hoveredKw && (
                <DrillInPopover
                    title={`Keyword: ${hoveredKw.keyword}`}
                    analyses={hoveredKw.analyses}
                    totalCount={hoveredKw.total_count}
                    isLight={isLight}
                    position={popoverPos}
                    onMouseEnter={() => { isOverPopover.current = true; }}
                    onMouseLeave={() => { isOverPopover.current = false; setHoveredIndex(null); }}
                />
            )}
        </div>
    );
}
