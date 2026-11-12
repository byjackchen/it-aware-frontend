'use client';

import { useRef, useState, useCallback, useMemo } from 'react';
import { Treemap, ResponsiveContainer } from 'recharts';
import type { KeywordItem, KeywordGroup } from '@/lib/types/survey-analytics';
import { DrillInPopover } from './DrillInPopover';

/** Simple squarified treemap layout: returns { x, y, w, h } in percentage (0–100) for each value. */
function squarify(values: number[], x0: number, y0: number, w0: number, h0: number): Array<{ x: number; y: number; w: number; h: number }> {
    const total = values.reduce((s, v) => s + v, 0);
    if (total === 0 || values.length === 0) return values.map(() => ({ x: x0, y: y0, w: 0, h: 0 }));
    if (values.length === 1) return [{ x: x0, y: y0, w: w0, h: h0 }];

    // Split into two halves where the first half is as close to 50% as possible
    let bestSplit = 1;
    let bestDiff = Infinity;
    let runningSum = 0;
    const halfTotal = total / 2;
    for (let i = 0; i < values.length - 1; i++) {
        runningSum += values[i];
        const diff = Math.abs(runningSum - halfTotal);
        if (diff < bestDiff) {
            bestDiff = diff;
            bestSplit = i + 1;
        }
    }

    const leftSum = values.slice(0, bestSplit).reduce((s, v) => s + v, 0);
    const leftFraction = leftSum / total;

    const leftValues = values.slice(0, bestSplit);
    const rightValues = values.slice(bestSplit);

    let leftRects: Array<{ x: number; y: number; w: number; h: number }>;
    let rightRects: Array<{ x: number; y: number; w: number; h: number }>;

    if (w0 >= h0) {
        // Split horizontally
        const leftW = w0 * leftFraction;
        leftRects = squarify(leftValues, x0, y0, leftW, h0);
        rightRects = squarify(rightValues, x0 + leftW, y0, w0 - leftW, h0);
    } else {
        // Split vertically
        const leftH = h0 * leftFraction;
        leftRects = squarify(leftValues, x0, y0, w0, leftH);
        rightRects = squarify(rightValues, x0, y0 + leftH, w0, h0 - leftH);
    }

    return [...leftRects, ...rightRects];
}

interface KeywordTreemapProps {
    keywords: KeywordItem[];
    isLight: boolean;
    groups?: KeywordGroup[];
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
    if (width < 30 || height < 20) return (
        <rect x={x} y={y} width={width} height={height} fill={isLight ? '#f8fafc' : '#0f172a'} stroke="none" />
    );

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

/** Renders SC sub-groups inside a location container using squarified layout. */
function NestedSubGroups({ subGroups, isLight, onHover, onLeave }: {
    subGroups: KeywordGroup[];
    isLight: boolean;
    onHover: (kw: KeywordItem, e: React.MouseEvent) => void;
    onLeave: () => void;
}) {
    const rects = useMemo(
        () => squarify(subGroups.map(sg => sg.total_count), 0, 0, 100, 100),
        [subGroups],
    );

    const GAP = 3;

    return (
        <div className="relative w-full h-full">
            {subGroups.map((sg, i) => {
                const r = rects[i];
                if (!r) return null;
                return (
                    <div
                        key={sg.group_oid}
                        className={`absolute rounded border overflow-hidden flex flex-col ${isLight ? 'border-slate-300 bg-white' : 'border-white/15 bg-[#1e293b]'}`}
                        style={{
                            left: `${r.x}%`,
                            top: `${r.y}%`,
                            width: `calc(${r.w}% - ${GAP}px)`,
                            height: `calc(${r.h}% - ${GAP}px)`,
                        }}
                    >
                        <div
                            className={`px-1.5 py-0.5 text-[10px] font-medium truncate shrink-0 ${isLight ? 'bg-slate-50 text-slate-500' : 'bg-white/5 text-gray-500'}`}
                            title={sg.group_name}
                        >
                            {sg.group_name}
                            <span className={`ml-1 font-normal ${isLight ? 'text-slate-300' : 'text-gray-600'}`}>
                                ({sg.total_count})
                            </span>
                        </div>
                        <div className="flex-1 min-h-0">
                            <GroupTreemap
                                groupName={sg.group_name}
                                keywords={sg.keywords}
                                isLight={isLight}
                                onHover={onHover}
                                onLeave={onLeave}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/** Color palette for location groups — known regions first, then a cycle of distinct hues. */
const LOCATION_GROUP_COLORS: Array<{ border: string; borderDark: string; bg: string; bgDark: string; header: string; headerDark: string; text: string; textDark: string }> = [
    // APAC – blue
    { border: '#3b82f6', borderDark: '#60a5fa', bg: '#eff6ff', bgDark: '#1e3a5f', header: '#dbeafe', headerDark: '#1e3a5f', text: '#1d4ed8', textDark: '#93c5fd' },
    // Americas – amber
    { border: '#f59e0b', borderDark: '#fbbf24', bg: '#fffbeb', bgDark: '#422006', header: '#fef3c7', headerDark: '#422006', text: '#b45309', textDark: '#fcd34d' },
    // EMEA – purple
    { border: '#8b5cf6', borderDark: '#a78bfa', bg: '#f5f3ff', bgDark: '#2e1065', header: '#ede9fe', headerDark: '#2e1065', text: '#6d28d9', textDark: '#c4b5fd' },
    // Extra palette entries for L2/L3 locations
    { border: '#10b981', borderDark: '#34d399', bg: '#ecfdf5', bgDark: '#064e3b', header: '#d1fae5', headerDark: '#064e3b', text: '#047857', textDark: '#6ee7b7' },
    { border: '#ef4444', borderDark: '#f87171', bg: '#fef2f2', bgDark: '#450a0a', header: '#fee2e2', headerDark: '#450a0a', text: '#b91c1c', textDark: '#fca5a5' },
    { border: '#06b6d4', borderDark: '#22d3ee', bg: '#ecfeff', bgDark: '#083344', header: '#cffafe', headerDark: '#083344', text: '#0e7490', textDark: '#67e8f9' },
    { border: '#ec4899', borderDark: '#f472b6', bg: '#fdf2f8', bgDark: '#500724', header: '#fce7f3', headerDark: '#500724', text: '#be185d', textDark: '#f9a8d4' },
    { border: '#f97316', borderDark: '#fb923c', bg: '#fff7ed', bgDark: '#431407', header: '#ffedd5', headerDark: '#431407', text: '#c2410c', textDark: '#fdba74' },
    { border: '#14b8a6', borderDark: '#2dd4bf', bg: '#f0fdfa', bgDark: '#042f2e', header: '#ccfbf1', headerDark: '#042f2e', text: '#0f766e', textDark: '#5eead4' },
    { border: '#6366f1', borderDark: '#818cf8', bg: '#eef2ff', bgDark: '#1e1b4b', header: '#e0e7ff', headerDark: '#1e1b4b', text: '#4338ca', textDark: '#a5b4fc' },
];

/** Map well-known region names to fixed palette indices. */
const KNOWN_REGION_INDEX: Record<string, number> = { APAC: 0, Americas: 1, EMEA: 2 };

function getGroupColor(groupName: string, fallbackIndex: number) {
    const knownIdx = KNOWN_REGION_INDEX[groupName];
    const idx = knownIdx !== undefined ? knownIdx : 3 + (fallbackIndex % (LOCATION_GROUP_COLORS.length - 3));
    return LOCATION_GROUP_COLORS[idx];
}

export function KeywordTreemap({ keywords, isLight, groups, ungroupedKeywords, ungroupedLabel = 'Uncategorized' }: KeywordTreemapProps) {
    const [hoveredKw, setHoveredKw] = useState<KeywordItem | null>(null);
    const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
    const hoverTimeout = useRef<ReturnType<typeof setTimeout>>(null);
    const isOverPopover = useRef(false);

    const isGrouped = !!groups && groups.length > 0;
    const isNested = isGrouped && groups!.some(g => g.sub_groups && g.sub_groups.length > 0);

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
        const result: Array<{ name: string; oid: string; keywords: KeywordItem[]; totalCount: number; subGroups?: KeywordGroup[] }> = [];
        for (const g of groups!) {
            if (g.keywords.length > 0 || (g.sub_groups && g.sub_groups.length > 0)) {
                result.push({
                    name: g.group_name,
                    oid: g.group_oid,
                    keywords: g.keywords.slice(0, 50),
                    totalCount: g.total_count,
                    subGroups: g.sub_groups,
                });
            }
        }
        if (ungroupedKeywords?.length) {
            const totalCount = ungroupedKeywords.reduce((sum, kw) => sum + kw.total_count, 0);
            result.push({ name: ungroupedLabel, oid: '__ungrouped__', keywords: ungroupedKeywords.slice(0, 50), totalCount });
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

    // Compute treemap layout for groups (squarified slice-and-dice)
    const GROUPED_HEIGHT = isNested ? 900 : 750;
    const GAP = 4;

    const groupRects = useMemo(() => {
        if (!isGrouped || displayGroups.length === 0) return [];
        return squarify(displayGroups.map(g => g.totalCount), 0, 0, 100, 100);
    }, [isGrouped, displayGroups]);

    return (
        <div className="relative">
            {isGrouped ? (
                <div className="relative w-full" style={{ height: GROUPED_HEIGHT }}>
                    {displayGroups.map((group, i) => {
                        const r = groupRects[i];
                        if (!r) return null;
                        const hasSubGroups = group.subGroups && group.subGroups.length > 0;
                        const gc = getGroupColor(group.name, i);
                        return (
                            <div
                                key={group.oid}
                                className="absolute rounded-lg border-2 overflow-hidden flex flex-col"
                                style={{
                                    left: `${r.x}%`,
                                    top: `${r.y}%`,
                                    width: `calc(${r.w}% - ${GAP}px)`,
                                    height: `calc(${r.h}% - ${GAP}px)`,
                                    borderColor: isLight ? gc.border : gc.borderDark,
                                    backgroundColor: isLight ? gc.bg : gc.bgDark,
                                }}
                            >
                                <div
                                    className="px-2.5 py-1 text-xs font-semibold truncate shrink-0"
                                    style={{
                                        backgroundColor: isLight ? gc.header : gc.headerDark,
                                        color: isLight ? gc.text : gc.textDark,
                                    }}
                                    title={group.name}
                                >
                                    {group.name}
                                    <span className="ml-1.5 font-normal" style={{ opacity: 0.6 }}>
                                        ({group.totalCount})
                                    </span>
                                </div>
                                <div className="flex-1 min-h-0">
                                    {hasSubGroups ? (
                                        <NestedSubGroups
                                            subGroups={group.subGroups!}
                                            isLight={isLight}
                                            onHover={handleCellMouseEnter}
                                            onLeave={handleCellMouseLeave}
                                        />
                                    ) : (
                                        <GroupTreemap
                                            groupName={group.name}
                                            keywords={group.keywords}
                                            isLight={isLight}
                                            onHover={handleCellMouseEnter}
                                            onLeave={handleCellMouseLeave}
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={550}>
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
