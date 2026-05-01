'use client';

/**
 * Deferred wrapper around KeywordTreemap. Two indirect benefits:
 *   1. next/dynamic + Suspense splits its (heavy: recharts + custom SVG)
 *      bundle out of the analytics route's initial paint.
 *   2. useDeferredValue lets Recharts re-render at lower priority so rapid
 *      input changes (filters) don't block click handlers elsewhere.
 */

import { Suspense, useDeferredValue } from 'react';
import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/layout/skeletons';
import type { ComponentProps } from 'react';

const KeywordTreemap = dynamic(
    () =>
        import('@/app/(main)/campaign/survey-analytics/charts/KeywordTreemap').then(
            (m) => m.KeywordTreemap,
        ),
    {
        ssr: false,
        loading: () => <ChartSkeleton height={750} />,
    },
);

type KeywordTreemapProps = ComponentProps<typeof KeywordTreemap>;

export function DeferredKeywordTreemap(props: KeywordTreemapProps) {
    // Defer the props that drive expensive layout (groups + keywords).
    const deferredGroups = useDeferredValue(props.groups);
    const deferredKeywords = useDeferredValue(props.keywords);
    const deferredUngrouped = useDeferredValue(props.ungroupedKeywords);

    return (
        <Suspense fallback={<ChartSkeleton height={750} />}>
            <KeywordTreemap
                {...props}
                groups={deferredGroups}
                keywords={deferredKeywords}
                ungroupedKeywords={deferredUngrouped}
            />
        </Suspense>
    );
}
