# Negative Feedback Focus Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated section to the Survey Analytics dashboard that isolates negative feedback by category, sorted by volume, with typical issue examples and location filtering.

**Architecture:** New `NegativeFeedbackSection` component placed between AnalysisClassification and KeywordHeatmap. Reuses the existing `analysis-classification` API via `useSurveyAnalytics` hook (SWR-cached). Left-right layout: horizontal bar chart (Recharts) + expandable table.

**Tech Stack:** Next.js, React, TypeScript, Recharts, next-intl, Tailwind CSS, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-31-negative-feedback-section-design.md`

---

## File Structure

| File | Role |
|------|------|
| `app/(main)/campaign/survey-analytics/NegativeFeedbackSection.tsx` | **Create** — Section container: fetches data, manages dimension toggle + location filter state, renders NegativeBar + NegativeTable |
| `app/(main)/campaign/survey-analytics/charts/NegativeBar.tsx` | **Create** — Red horizontal bar chart showing negative counts per category |
| `app/(main)/campaign/survey-analytics/charts/NegativeTable.tsx` | **Create** — Expandable table with 3 inline typical issues + "View More" |
| `app/(main)/campaign/survey-analytics/SurveyAnalyticsDashboard.tsx` | **Modify** — Import and render NegativeFeedbackSection between AnalysisClassification and KeywordHeatmap |
| `messages/en.json` | **Modify** — Add `SurveyAnalytics.negativeFeedback.*` keys |
| `messages/zh.json` | **Modify** — Add `SurveyAnalytics.negativeFeedback.*` keys |

---

### Task 1: Add i18n keys

**Files:**
- Modify: `messages/en.json:60-131` (inside `SurveyAnalytics` object)
- Modify: `messages/zh.json:60-131` (inside `SurveyAnalytics` object)

- [ ] **Step 1: Add English i18n keys**

In `messages/en.json`, add a new `negativeFeedback` block inside the `SurveyAnalytics` object (after the `region` block, before the closing `}` of `SurveyAnalytics`):

```json
"negativeFeedback": {
    "title": "Negative Feedback Focus",
    "loading": "Loading negative feedback analysis...",
    "serviceCatalog": "Service Catalog",
    "configItem": "Configuration Item",
    "allLocations": "All Locations",
    "count": "Count",
    "negativeRate": "negative rate",
    "typicalIssues": "Typical Issues",
    "viewMore": "View More ({count})",
    "collapse": "Collapse",
    "noNegative": "No negative feedback found",
    "issue": "issue",
    "issues": "issues"
}
```

- [ ] **Step 2: Add Chinese i18n keys**

In `messages/zh.json`, add matching `negativeFeedback` block:

```json
"negativeFeedback": {
    "title": "负面反馈聚焦",
    "loading": "正在加载负面反馈分析...",
    "serviceCatalog": "服务目录",
    "configItem": "配置项",
    "allLocations": "全部地区",
    "count": "数量",
    "negativeRate": "负面比例",
    "typicalIssues": "典型问题",
    "viewMore": "查看更多 ({count})",
    "collapse": "收起",
    "noNegative": "未发现负面反馈",
    "issue": "条问题",
    "issues": "条问题"
}
```

- [ ] **Step 3: Commit**

```bash
git add messages/en.json messages/zh.json
git commit -m "feat: add i18n keys for negative feedback section"
```

---

### Task 2: Create NegativeBar chart component

**Files:**
- Create: `app/(main)/campaign/survey-analytics/charts/NegativeBar.tsx`

- [ ] **Step 1: Create NegativeBar.tsx**

This is a horizontal bar chart showing only negative counts, sorted descending. It accepts a `hoveredIndex` prop and an `onHover` callback for bidirectional highlight sync with the table.

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add app/\(main\)/campaign/survey-analytics/charts/NegativeBar.tsx
git commit -m "feat: add NegativeBar horizontal chart component"
```

---

### Task 3: Create NegativeTable component

**Files:**
- Create: `app/(main)/campaign/survey-analytics/charts/NegativeTable.tsx`

- [ ] **Step 1: Create NegativeTable.tsx**

Expandable table showing category name, negative count/percentage, 3 inline typical issues, and "View More" expansion. Reuses DrillInPopover's analysis rendering style inline.

```tsx
'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText, ClipboardList } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AnalysisPreview } from '@/lib/types/survey-analytics';

export interface NegativeTableItem {
    oid: string;
    name: string;
    negativeCount: number;
    totalCount: number;
    negativeAnalyses: AnalysisPreview[];
}

interface NegativeTableProps {
    data: NegativeTableItem[];
    isLight: boolean;
    hoveredIndex: number | null;
    onHover: (index: number | null) => void;
}

function AnalysisRow({ a, isLight }: { a: AnalysisPreview; isLight: boolean }) {
    const t = useTranslations('SurveyAnalytics');
    return (
        <div className={`flex items-start justify-between gap-2 py-1.5 ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                        {a.topic}
                    </span>
                    {a.intent && (
                        <span className={`text-[10px] px-1.5 py-0 rounded-full ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-400'}`}>
                            {a.intent}
                        </span>
                    )}
                </div>
                {a.fact && (
                    <p className={`text-[11px] leading-relaxed truncate ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                        {a.fact}
                    </p>
                )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
                <button
                    onClick={() => window.open(`/data/analyses/${a.oid}`, '_blank')}
                    className={`p-1 rounded transition-colors ${isLight
                        ? 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                        : 'text-gray-600 hover:text-blue-400 hover:bg-white/10'
                    }`}
                    title={t('popover.openAnalysis')}
                >
                    <FileText className="w-3 h-3" />
                </button>
                {a.source_oid && (
                    <button
                        onClick={() => window.open(`/data/surveys/${a.source_oid}`, '_blank')}
                        className={`p-1 rounded transition-colors ${isLight
                            ? 'text-slate-400 hover:text-green-600 hover:bg-green-50'
                            : 'text-gray-600 hover:text-green-400 hover:bg-white/10'
                        }`}
                        title={t('popover.openSurvey')}
                    >
                        <ClipboardList className="w-3 h-3" />
                    </button>
                )}
            </div>
        </div>
    );
}

export function NegativeTable({ data, isLight, hoveredIndex, onHover }: NegativeTableProps) {
    const t = useTranslations('SurveyAnalytics');
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    return (
        <div className={`rounded-lg border overflow-hidden ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
            {data.length === 0 ? (
                <div className={`p-8 text-center text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                    {t('negativeFeedback.noNegative')}
                </div>
            ) : (
                <div className="divide-y divide-inherit">
                    {data.map((item, index) => {
                        const isExpanded = expandedIndex === index;
                        const isHighlighted = hoveredIndex === index;
                        const negativePercent = item.totalCount > 0 ? Math.round((item.negativeCount / item.totalCount) * 100) : 0;
                        const inlineAnalyses = item.negativeAnalyses.slice(0, 3);
                        const hasMore = item.negativeAnalyses.length > 3;

                        return (
                            <div
                                key={item.oid}
                                className={`transition-colors ${isHighlighted
                                    ? isLight ? 'bg-red-50/50' : 'bg-red-500/5'
                                    : ''
                                }`}
                                onMouseEnter={() => onHover(index)}
                                onMouseLeave={() => onHover(null)}
                            >
                                {/* Main Row */}
                                <div className="px-4 py-3">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`text-sm font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                {item.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="text-sm font-semibold text-red-500">
                                                {item.negativeCount}
                                            </span>
                                            <span className={`text-xs px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500`}>
                                                {negativePercent}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Inline 3 typical issues */}
                                    <div className={`space-y-0.5 ${isLight ? 'divide-slate-100' : 'divide-white/5'}`}>
                                        {inlineAnalyses.map((a) => (
                                            <AnalysisRow key={a.oid} a={a} isLight={isLight} />
                                        ))}
                                    </div>

                                    {/* View More / Collapse button */}
                                    {hasMore && (
                                        <button
                                            onClick={() => setExpandedIndex(isExpanded ? null : index)}
                                            className={`mt-2 flex items-center gap-1 text-xs font-medium transition-colors ${isLight
                                                ? 'text-blue-600 hover:text-blue-700'
                                                : 'text-blue-400 hover:text-blue-300'
                                            }`}
                                        >
                                            {isExpanded ? (
                                                <>
                                                    <ChevronUp className="w-3 h-3" />
                                                    {t('negativeFeedback.collapse')}
                                                </>
                                            ) : (
                                                <>
                                                    <ChevronDown className="w-3 h-3" />
                                                    {t('negativeFeedback.viewMore', { count: item.negativeAnalyses.length })}
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>

                                {/* Expanded analyses */}
                                {isExpanded && (
                                    <div className={`px-4 pb-3 space-y-0.5 border-t ${isLight ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/[0.02]'}`}>
                                        {item.negativeAnalyses.slice(3).map((a) => (
                                            <AnalysisRow key={a.oid} a={a} isLight={isLight} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(main\)/campaign/survey-analytics/charts/NegativeTable.tsx
git commit -m "feat: add NegativeTable expandable component"
```

---

### Task 4: Create NegativeFeedbackSection container

**Files:**
- Create: `app/(main)/campaign/survey-analytics/NegativeFeedbackSection.tsx`

- [ ] **Step 1: Create NegativeFeedbackSection.tsx**

Main section component: fetches data via `useSurveyAnalytics`, manages dimension toggle and location filter state, processes data to extract negative-only items sorted descending, renders NegativeBar + NegativeTable side by side.

```tsx
'use client';

import { useState, useMemo } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSurveyAnalytics } from '@/lib/hooks/useSurveyAnalytics';
import type { AnalysisClassificationResponse, ServiceCatalogBreakdown, ConfigItemBreakdown } from '@/lib/types/survey-analytics';
import { NegativeBar } from './charts/NegativeBar';
import { NegativeTable } from './charts/NegativeTable';
import type { NegativeBarItem } from './charts/NegativeBar';
import type { NegativeTableItem } from './charts/NegativeTable';

interface NegativeFeedbackSectionProps {
    batchOid: string;
    isLight: boolean;
}

type Dimension = 'service_catalog' | 'config_item';

function processBreakdown(items: (ServiceCatalogBreakdown | ConfigItemBreakdown)[], locationFilter: string | null) {
    let filtered = items;
    if (locationFilter) {
        filtered = items.filter((item) =>
            item.top_locations.some((loc) => loc.location_name === locationFilter)
        );
    }

    const processed = filtered
        .filter((item) => item.semantic.negative > 0)
        .sort((a, b) => b.semantic.negative - a.semantic.negative)
        .slice(0, 15);

    const barData: NegativeBarItem[] = processed.map((item) => ({
        oid: item.oid,
        name: item.name,
        negativeCount: item.semantic.negative,
    }));

    const tableData: NegativeTableItem[] = processed.map((item) => ({
        oid: item.oid,
        name: item.name,
        negativeCount: item.semantic.negative,
        totalCount: item.count,
        negativeAnalyses: item.analyses.filter((a) => a.semantic === 'negative'),
    }));

    return { barData, tableData };
}

export function NegativeFeedbackSection({ batchOid, isLight }: NegativeFeedbackSectionProps) {
    const t = useTranslations('SurveyAnalytics');
    const [dimension, setDimension] = useState<Dimension>('service_catalog');
    const [locationFilter, setLocationFilter] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const url = batchOid
        ? `/api/dashboard/survey-analytics/analysis-classification?batch_oid=${batchOid}`
        : null;
    const { data, isLoading, error } = useSurveyAnalytics<AnalysisClassificationResponse>(url);

    const locationOptions = useMemo(() => {
        if (!data) return [];
        return data.by_location.map((loc) => loc.location_name).sort();
    }, [data]);

    const { barData, tableData } = useMemo(() => {
        if (!data) return { barData: [], tableData: [] };
        const source = dimension === 'service_catalog'
            ? data.by_service_catalog
            : data.by_configuration_item;
        return processBreakdown(source, locationFilter);
    }, [data, dimension, locationFilter]);

    if (isLoading) {
        return (
            <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                <span className={`inline-flex items-center gap-2 text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    <Loader2 className="w-4 h-4 animate-spin" /> {t('negativeFeedback.loading')}
                </span>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                <p className="text-sm">{error || t('classification.loadFailed')}</p>
            </div>
        );
    }

    const DIMENSIONS: { key: Dimension; label: string }[] = [
        { key: 'service_catalog', label: t('negativeFeedback.serviceCatalog') },
        { key: 'config_item', label: t('negativeFeedback.configItem') },
    ];

    return (
        <section className="space-y-4">
            <h2 className={`flex items-center gap-2 text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                <AlertTriangle className="w-5 h-5 text-red-500" />
                {t('negativeFeedback.title')}
            </h2>

            {/* Controls Bar */}
            <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                {/* Dimension Toggle */}
                <div className={`flex rounded-lg border ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                    {DIMENSIONS.map((dim) => (
                        <button
                            key={dim.key}
                            onClick={() => { setDimension(dim.key); setHoveredIndex(null); }}
                            className={`px-3 py-1.5 text-xs font-medium transition-colors ${dimension === dim.key
                                ? isLight
                                    ? 'bg-red-50 text-red-600 border-red-200'
                                    : 'bg-red-500/10 text-red-400'
                                : isLight
                                    ? 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                            }`}
                        >
                            {dim.label}
                        </button>
                    ))}
                </div>

                {/* Location Filter */}
                <select
                    value={locationFilter ?? ''}
                    onChange={(e) => { setLocationFilter(e.target.value || null); setHoveredIndex(null); }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${isLight
                        ? 'border-slate-200 bg-white text-slate-700'
                        : 'border-white/10 bg-white/5 text-gray-300'
                    }`}
                >
                    <option value="">{t('negativeFeedback.allLocations')}</option>
                    {locationOptions.map((loc) => (
                        <option key={loc} value={loc}>{loc}</option>
                    ))}
                </select>
            </div>

            {/* Content: Left chart + Right table */}
            {barData.length === 0 ? (
                <div className={`rounded-xl border p-8 text-center ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <p className={`text-sm ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                        {t('negativeFeedback.noNegative')}
                    </p>
                </div>
            ) : (
                <div className={`rounded-xl border ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex flex-col lg:flex-row">
                        {/* Left: Bar Chart */}
                        <div className="lg:w-2/5 p-4 border-b lg:border-b-0 lg:border-r ${isLight ? 'border-slate-200' : 'border-white/10'}">
                            <NegativeBar
                                data={barData}
                                isLight={isLight}
                                hoveredIndex={hoveredIndex}
                                onHover={setHoveredIndex}
                            />
                        </div>

                        {/* Right: Table */}
                        <div className="lg:w-3/5 p-4 overflow-y-auto" style={{ maxHeight: Math.max(320, barData.length * 36 + 40) }}>
                            <NegativeTable
                                data={tableData}
                                isLight={isLight}
                                hoveredIndex={hoveredIndex}
                                onHover={setHoveredIndex}
                            />
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(main\)/campaign/survey-analytics/NegativeFeedbackSection.tsx
git commit -m "feat: add NegativeFeedbackSection container component"
```

---

### Task 5: Wire into SurveyAnalyticsDashboard

**Files:**
- Modify: `app/(main)/campaign/survey-analytics/SurveyAnalyticsDashboard.tsx`

- [ ] **Step 1: Add import**

Add after the existing `AnalysisClassification` import (line 9):

```tsx
import { NegativeFeedbackSection } from './NegativeFeedbackSection';
```

- [ ] **Step 2: Render NegativeFeedbackSection**

In the `<div key={refreshKey} className="space-y-8">` block (line 63), add `NegativeFeedbackSection` between `AnalysisClassification` and `KeywordHeatmap`:

```tsx
<SubmissionOverview batchOid={selectedBatchOid} isLight={isLight} />
<AnalysisClassification batchOid={selectedBatchOid} isLight={isLight} />
<NegativeFeedbackSection batchOid={selectedBatchOid} isLight={isLight} />
<KeywordHeatmap batchOid={selectedBatchOid} isLight={isLight} />
```

- [ ] **Step 3: Commit**

```bash
git add app/\(main\)/campaign/survey-analytics/SurveyAnalyticsDashboard.tsx
git commit -m "feat: wire NegativeFeedbackSection into dashboard"
```

---

### Task 6: Build verification

- [ ] **Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run local Docker build**

```bash
docker build -t it-aware-frontend:latest .
```

Expected: Build succeeds.

- [ ] **Step 3: Run container and verify**

```bash
docker rm -f it-aware-frontend 2>/dev/null; docker run -d -p 3007:3000 --network dev-net --env-file ./.env.docker --name it-aware-frontend it-aware-frontend:latest
```

Navigate to `http://localhost:3007/campaign/survey-analytics`, select a batch, and verify:
- New "Negative Feedback Focus" section appears between Analysis Classification and Keyword Heatmap
- Dimension toggle switches between Service Catalog and Configuration Item
- Location dropdown filters categories
- Left bar chart shows red horizontal bars sorted by negative count
- Right table shows category name, count, percentage, 3 inline issues
- "View More" expands to show all negative analyses
- Hover syncs highlight between chart and table

- [ ] **Step 4: Fix any issues found and commit**
