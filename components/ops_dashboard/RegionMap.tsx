'use client';

/**
 * RegionMap — world map with AMER / EMEA / APAC / OTHER bubbles sized
 * by the count supplied per region.
 *
 * Wraps {@link react-simple-maps} with a dynamic SSR-off import to
 * sidestep the React 19 `useRef` interop known issue. The underlying
 * geography is bundled from `world-atlas/countries-110m.json` so the
 * chart works offline.
 *
 * Intended for the Active Monitoring Hub (1.3.10) but generic enough
 * to drop into any page that can derive `{ region → count }`.
 */

import dynamic from 'next/dynamic';

export type Region = 'AMER' | 'EMEA' | 'APAC' | 'OTHER';

export interface RegionBubble {
    region: Region;
    count: number;
}

export interface RegionMapProps {
    /** Counts keyed by region. Missing regions render as zero. */
    data: RegionBubble[];
    /** SVG viewBox width in pixels. Height scales via `ResponsiveContainer`. */
    width?: number;
    height?: number;
    /** Optional title rendered above the map. */
    title?: string;
    subtitle?: string;
    /** Optional definition / formula shown on hover as a tooltip next to the title. */
    info?: string;
}

const RegionMapImpl = dynamic(() => import('./RegionMapImpl').then((m) => m.RegionMapImpl), {
    ssr: false,
    loading: () => (
        <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">Loading map…</div>
    ),
});

export function RegionMap(props: RegionMapProps) {
    return <RegionMapImpl {...props} />;
}
