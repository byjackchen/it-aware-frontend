'use client';

/**
 * RegionMapImpl — client-only inner for {@link RegionMap}.
 *
 * Split out so the parent can `dynamic(..., { ssr: false })` the heavy
 * `react-simple-maps` + d3 stack. The React 19 runtime has a known
 * quirk with `react-simple-maps@3`'s `ref` handling under SSR, so we
 * only render this on the client.
 *
 * Geography source: bundled `world-atlas/countries-110m.json` (~110KB).
 * We fall back to the CDN if the bundled file can't be imported (which
 * shouldn't happen locally, but keeps prod resilient).
 *
 * Zoom & pan
 * ----------
 * Wrapped in `ZoomableGroup` so users can wheel-zoom and drag-pan the
 * globe. An absolute-positioned control cluster (+ / − / reset) sits in
 * the top-right. Bubbles + labels grow with the zoom transform (no
 * counter-scale) so the count number stays legible — and even gets
 * easier to read — as the user zooms into a region.
 */

import { useCallback, useMemo, useState } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { TitleWithInfo } from './TitleWithInfo';
import type { Region, RegionMapProps } from './RegionMap';

// The geography prop accepts a string URL or a parsed topojson object.
// We use the CDN URL (cached by react-simple-maps internally via d3-fetch)
// so we don't force consumers to configure a JSON-import loader.
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

const REGION_COORDS: Record<Region, [number, number]> = {
    AMER: [-100, 40],
    EMEA: [15, 50],
    APAC: [120, 30],
    // Render "Other" off-map (below Antarctica) so it doesn't collide with
    // real regions when counts are non-zero but geographically ambiguous.
    OTHER: [0, -58],
};

const REGION_COLORS: Record<Region, string> = {
    AMER: '#3b82f6',
    EMEA: '#8b5cf6',
    APAC: '#f59e0b',
    OTHER: '#94a3b8',
};

const MIN_RADIUS = 8;
const MAX_RADIUS = 40;

/** Log-scale the radius so a 1000-count bubble doesn't dwarf a 10-count one. */
function radiusFor(count: number, max: number): number {
    if (count <= 0) return 0;
    if (max <= 0) return MIN_RADIUS;
    const ratio = Math.log1p(count) / Math.log1p(max);
    return MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS);
}

export function RegionMapImpl({ data, width = 800, height = 400, title, subtitle, info }: RegionMapProps) {
    const { theme } = useTheme();
    const isLight = theme === 'light';

    // ----- Zoom state -----
    // `react-simple-maps` ZoomableGroup is controlled via `zoom` + `center`
    // and fires onMoveEnd after wheel/drag gestures. We keep both in React
    // state so the +/-/reset buttons stay in sync with mouse interaction.
    const INITIAL_CENTER: [number, number] = [15, 10];
    const MIN_ZOOM = 1;
    const MAX_ZOOM = 8;
    const ZOOM_STEP = 1.5;

    const [zoom, setZoom] = useState<number>(1);
    const [center, setCenter] = useState<[number, number]>(INITIAL_CENTER);

    const handleMoveEnd = useCallback(
        (position: { coordinates: [number, number]; zoom: number }) => {
            setZoom(position.zoom);
            setCenter(position.coordinates);
        },
        [],
    );

    const zoomIn = useCallback(() => {
        setZoom((z) => Math.min(z * ZOOM_STEP, MAX_ZOOM));
    }, []);

    const zoomOut = useCallback(() => {
        setZoom((z) => Math.max(z / ZOOM_STEP, MIN_ZOOM));
    }, []);

    const zoomReset = useCallback(() => {
        setZoom(1);
        setCenter(INITIAL_CENTER);
    }, []);

    const cardBase = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5';
    const titleCls = isLight ? 'text-slate-800' : 'text-white';
    const subtitleCls = isLight ? 'text-slate-500' : 'text-gray-400';
    const landFill = isLight ? '#dbeafe' : '#1e3a5f';
    const landStroke = isLight ? '#93c5fd' : '#2d5a8e';
    const oceanFill = isLight ? '#f1f5f9' : '#0c1a3a';
    const btnCls = isLight
        ? 'bg-white/90 hover:bg-white border-slate-200 text-slate-700'
        : 'bg-black/40 hover:bg-black/60 border-white/10 text-gray-200';

    const counts = useMemo<Record<Region, number>>(() => {
        const acc: Record<Region, number> = { AMER: 0, EMEA: 0, APAC: 0, OTHER: 0 };
        for (const d of data) acc[d.region] = (acc[d.region] ?? 0) + d.count;
        return acc;
    }, [data]);

    const maxCount = Math.max(counts.AMER, counts.EMEA, counts.APAC, counts.OTHER, 1);

    return (
        <div className={`rounded-xl border ${cardBase} overflow-hidden flex flex-col`}>
            {(title || subtitle) && (
                <div className="p-4 pb-2">
                    {title && <TitleWithInfo title={title} subtitle={subtitle} info={info} />}
                    {!title && subtitle && <p className={`text-xs mt-0.5 ${subtitleCls}`}>{subtitle}</p>}
                </div>
            )}
            <div style={{ background: oceanFill, width: '100%', height, position: 'relative' }}>
                {/* Zoom controls — absolute-positioned top-right */}
                <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                    <button
                        type="button"
                        onClick={zoomIn}
                        disabled={zoom >= MAX_ZOOM}
                        aria-label="Zoom in"
                        className={`w-7 h-7 rounded-md border flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${btnCls}`}
                    >
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={zoomOut}
                        disabled={zoom <= MIN_ZOOM}
                        aria-label="Zoom out"
                        className={`w-7 h-7 rounded-md border flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${btnCls}`}
                    >
                        <Minus className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={zoomReset}
                        disabled={zoom === 1 && center[0] === INITIAL_CENTER[0] && center[1] === INITIAL_CENTER[1]}
                        aria-label="Reset zoom"
                        className={`w-7 h-7 rounded-md border flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${btnCls}`}
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                </div>

                <ComposableMap
                    projection="geoNaturalEarth1"
                    projectionConfig={{ scale: Math.min(width, height) / 2.8, center: [15, 10] }}
                    width={width}
                    height={height}
                    style={{ width: '100%', height: '100%' }}
                >
                    <ZoomableGroup
                        zoom={zoom}
                        center={center}
                        minZoom={MIN_ZOOM}
                        maxZoom={MAX_ZOOM}
                        onMoveEnd={handleMoveEnd}
                    >
                        <Geographies geography={GEO_URL}>
                            {({ geographies }: { geographies: Array<{ rsmKey: string }> }) =>
                                geographies.map((geo) => (
                                    <Geography
                                        key={geo.rsmKey}
                                        geography={geo}
                                        fill={landFill}
                                        stroke={landStroke}
                                        strokeWidth={0.4}
                                        style={{
                                            default: { outline: 'none' },
                                            hover: { outline: 'none', fill: isLight ? '#93c5fd' : '#2d5a8e' },
                                            pressed: { outline: 'none' },
                                        }}
                                    />
                                ))
                            }
                        </Geographies>

                        {(Object.keys(REGION_COORDS) as Region[]).map((region) => {
                            const count = counts[region] ?? 0;
                            if (count === 0) return null;
                            const r = radiusFor(count, maxCount);
                            // Bubble + label render at native size and grow with the
                            // map's zoom transform — matches the user's mental model
                            // (zoom-in = "look closer at the bubble's number").
                            return (
                                <Marker key={region} coordinates={REGION_COORDS[region]}>
                                    <circle
                                        r={r}
                                        fill={REGION_COLORS[region]}
                                        fillOpacity={0.75}
                                        stroke="#ffffff"
                                        strokeWidth={1.5}
                                    />
                                    <text
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        fill="white"
                                        fontSize={r > 20 ? 11 : 9}
                                        fontWeight={700}
                                    >
                                        {count}
                                    </text>
                                    <text
                                        textAnchor="middle"
                                        fill={isLight ? '#334155' : '#cbd5e1'}
                                        fontSize={9}
                                        fontWeight={600}
                                        y={r + 10}
                                    >
                                        {region}
                                    </text>
                                </Marker>
                            );
                        })}
                    </ZoomableGroup>
                </ComposableMap>
            </div>
        </div>
    );
}
