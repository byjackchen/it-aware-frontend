'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { Treemap, ResponsiveContainer } from 'recharts';
import type { KeywordItem, ServiceCatalogKeywordGroup } from '@/lib/types/survey-analytics';
import { DrillInPopover } from './DrillInPopover';

interface KeywordTreemapProps {
    keywords: KeywordItem[];
    isLight: boolean;
    groups?: ServiceCatalogKeywordGroup[];
    ungroupedKeywords?: KeywordItem[];
    ungroupedLabel?: string;
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

/** A single flat treemap for one group, with its own hover state. */
function GroupTreemap({ groupName, keywords, isLight, onHover, onLeave }: {
    groupName: string;
    keywords: KeywordItem[];
    isLight: boolean;
    onHover: (kw: KeywordItem, e: React.MouseEvent) => void;
    onLeave: () => void;
}) {
    const treemapData = keywords.map((kw) => ({
        name: kw.keyword,
        size: kw.total_count,
        fill: getSentimentColor(kw),
        ...kw,
    }));

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
                onMouseEnter={(e) => kw && onHover(kw, e)}
                onMouseLeave={onLeave}
            />
        );
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <Treemap
                data={treemapData}
                dataKey="size"
                stroke="none"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                content={renderContent as any}
                isAnimationActive={false}
            />
        </ResponsiveContainer>
    );
}

export function KeywordTreemap({ keywords, isLight, groups, ungroupedKeywords, ungroupedLabel = 'Uncategorized' }: KeywordTreemapProps) {
    const [hoveredKw, setHoveredKw] = useState<KeywordItem | null>(null);
    const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
    const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(null);
    const isOverPopover = useRef(false);

    const isGrouped = !!groups && groups.length > 0;

    // Flat treemap data
    const flatTreemapData = useMemo(() => {
        if (isGrouped || !keywords) return [];
        return keywords.slice(0, 50).map((kw) => ({
            name: kw.keyword,
            size: kw.total_count,
            fill: getSentimentColor(kw),
            ...kw,
        }));
    }, [isGrouped, keywords]);

    // Build display groups list (groups + optional ungrouped)
    const displayGroups = useMemo(() => {
        if (!isGrouped) return [];
        const result: Array<{ name: string; keywords: KeywordItem[]; totalCount: number }> = [];
        for (const g of groups!) {
            if (g.keywords.length > 0) {
                result.push({ name: g.service_catalog_name, keywords: g.keywords.slice(0, 30), totalCount: g.total_count });
            }
        }
        if (ungroupedKeywords?.length) {
            const totalCount = ungroupedKeywords.reduce((sum, kw) => sum + kw.total_count, 0);
            result.push({ name: ungroupedLabel, keywords: ungroupedKeywords.slice(0, 30), totalCount });
        }
        return result;
    }, [isGrouped, groups, ungroupedKeywords, ungroupedLabel]);

    const handleCellMouseEnter = useCallback((kwItem: KeywordItem, e: React.MouseEvent) => {
        if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
        setHoveredKw(kwItem);
        setPopoverPos({ x: e.clientX + 16, y: e.clientY - 20 });
    }, []);

    const handleCellMouseLeave = useCallback(() => {
        hoverTimeout.current = setTimeout(() => {
            if (!isOverPopover.current) setHoveredKw(null);
        }, 150);
    }, []);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderFlatContent = (props: any) => {
        const { x, y, width, height, name, fill, index } = props;
        const kw = flatTreemapData[index];
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
                onMouseEnter={(e) => kw && handleCellMouseEnter(kw, e)}
                onMouseLeave={handleCellMouseLeave}
            />
        );
    };

    // Compute proportional flex sizes for grouped layout
    const grandTotal = displayGroups.reduce((sum, g) => sum + g.totalCount, 0);

    return (
        <div className="relative">
            {isGrouped ? (
                <div className="flex flex-wrap gap-2" style={{ minHeight: 500 }}>
                    {displayGroups.map((group) => {
                        // Each group gets proportional width (min 200px)
                        const fraction = grandTotal > 0 ? group.totalCount / grandTotal : 1 / displayGroups.length;
                        const widthPercent = Math.max(15, fraction * 100);
                        return (
                            <div
                                key={group.name}
                                className={`rounded-lg border overflow-hidden flex flex-col ${isLight ? 'border-slate-200' : 'border-white/10'}`}
                                style={{
                                    flex: `${widthPercent} 1 0%`,
                                    minWidth: 180,
                                    minHeight: 160,
                                }}
                            >
                                <div className={`px-2.5 py-1.5 text-xs font-semibold truncate shrink-0 ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/5 text-gray-400'}`} title={group.name}>
                                    {group.name}
                                    <span className={`ml-1.5 font-normal ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                        ({group.totalCount})
                                    </span>
                                </div>
                                <div className="flex-1 min-h-0">
                                    <GroupTreemap
                                        groupName={group.name}
                                        keywords={group.keywords}
                                        isLight={isLight}
                                        onHover={handleCellMouseEnter}
                                        onLeave={handleCellMouseLeave}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={400}>
                    <Treemap
                        data={flatTreemapData}
                        dataKey="size"
                        stroke="none"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        content={renderFlatContent as any}
                        isAnimationActive={false}
                    />
                </ResponsiveContainer>
            )}

            {hoveredKw && (
                <DrillInPopover
                    title={`Keyword: ${hoveredKw.keyword}`}
                    analyses={hoveredKw.analyses}
                    totalCount={hoveredKw.total_count}
                    isLight={isLight}
                    position={popoverPos}
                    onMouseEnter={() => { isOverPopover.current = true; }}
                    onMouseLeave={() => { isOverPopover.current = false; setHoveredKw(null); }}
                />
            )}
        </div>
    );
}
