'use client';

import {
    AXIS_ENDCAP_RADIUS,
    AXIS_STROKE_WIDTH,
    EVENT_COLORS,
    HOVER_TOOLTIP_MAX_WIDTH,
    MARKER_RADIUS,
    SCENARIO_COLOR,
    SCENARIO_LINK_DASH,
    TICK_HEIGHT,
    TICK_LABEL_WIDTH,
} from './constants';
import type { TimelineGeometry, TimelineHeatBin, TimelineHoverPayload, TimelineRenderedEvent, TimelineScenarioBox } from './types';
import type { PersonaActivityEvent, PersonaActivityEventType, TimelineWindowState } from '@/app/(main)/persona/types';
import { formatExactTimestamp, formatHeatInterval, formatTickDate, hexToRgba } from './utils';

interface TimelineCanvasProps {
    geometry: TimelineGeometry;
    renderedEvents: TimelineRenderedEvent[];
    heatBins: TimelineHeatBin[];
    visibleHeatTypes: PersonaActivityEventType[];
    windowState: TimelineWindowState;
    timezone: string;
    isLight: boolean;
    hover: TimelineHoverPayload | null;
    t: (key: string, values?: Record<string, string | number>) => string;
    onEventClick: (event: PersonaActivityEvent) => void;
    onEventHover: (event: React.MouseEvent, item: PersonaActivityEvent) => void;
    onHeatHover: (event: React.MouseEvent, bin: TimelineHeatBin) => void;
    onClearHover: () => void;
    scenarioBoxes?: TimelineScenarioBox[];
    onScenarioClick?: (box: TimelineScenarioBox) => void;
    onScenarioHover?: (event: React.MouseEvent, box: TimelineScenarioBox) => void;
}

function getHeatIntensity(bin: TimelineHeatBin, type: PersonaActivityEventType): number {
    switch (type) {
        case 'incident':
            return bin.incidentIntensity;
        case 'request':
            return bin.requestIntensity;
        case 'interaction':
            return bin.interactionIntensity;
        case 'survey':
            return bin.surveyIntensity;
        case 'analysis':
            return bin.analysisIntensity;
        default:
            return 0;
    }
}

function getHeatCount(bin: TimelineHeatBin, type: PersonaActivityEventType): number {
    switch (type) {
        case 'incident':
            return bin.incidentCount;
        case 'request':
            return bin.requestCount;
        case 'interaction':
            return bin.interactionCount;
        case 'survey':
            return bin.surveyCount;
        case 'analysis':
            return bin.analysisCount;
        default:
            return 0;
    }
}

function buildHeatTitle(bin: TimelineHeatBin, timezone: string, t: (key: string, values?: Record<string, string | number>) => string): string {
    return [
        `${t('timeline.heatTooltip.interval')}: ${formatHeatInterval(bin.startMs, bin.endMs, timezone)}`,
        `${t('timeline.heatTooltip.total')}: ${bin.totalCount}`,
        `${t('timeline.heatTooltip.incident')}: ${bin.incidentCount}`,
        `${t('timeline.heatTooltip.request')}: ${bin.requestCount}`,
        `${t('timeline.heatTooltip.interaction')}: ${bin.interactionCount}`,
        `${t('timeline.heatTooltip.survey')}: ${bin.surveyCount}`,
        `${t('timeline.heatTooltip.analysis')}: ${bin.analysisCount}`,
    ].join('\n');
}

export function TimelineCanvas({
    geometry,
    renderedEvents,
    heatBins,
    visibleHeatTypes,
    windowState,
    timezone,
    isLight,
    hover,
    t,
    onEventClick,
    onEventHover,
    onHeatHover,
    onClearHover,
    scenarioBoxes,
    onScenarioClick,
    onScenarioHover,
}: TimelineCanvasProps) {
    const heatBinWidth = heatBins.length > 0 ? (geometry.axisWidth / heatBins.length) : geometry.axisWidth;

    const axisColor = isLight ? '#64748b' : '#a8b2c4';
    const tickColor = isLight ? 'rgba(71, 85, 105, 0.72)' : 'rgba(203, 213, 225, 0.58)';
    const tickLabelColor = isLight ? '#475569' : '#cbd5e1';

    return (
        <div style={{ width: `${geometry.canvasWidth}px`, height: `${geometry.canvasHeight}px` }} className="relative">
            <svg width={geometry.canvasWidth} height={geometry.canvasHeight} className="block">
                <rect
                    x={geometry.axisStartX}
                    y={geometry.dragRegionY}
                    width={geometry.axisWidth}
                    height={geometry.dragRegionHeight}
                    fill="transparent"
                    data-timeline-drag-region="true"
                />

                <text
                    x={geometry.axisStartX}
                    y={geometry.tickLabelY - 8}
                    fontSize={10}
                    fill={tickLabelColor}
                    textAnchor="start"
                >
                    {t('timeline.rangeStart')}
                </text>
                <text
                    x={geometry.axisEndX}
                    y={geometry.tickLabelY - 8}
                    fontSize={10}
                    fill={tickLabelColor}
                    textAnchor="end"
                >
                    {t('timeline.rangeEnd')}
                </text>

                {/* Scenario bezier links to activities */}
                {scenarioBoxes && scenarioBoxes.map((box) => {
                    // Build a map of rendered event oids for quick lookup
                    return box.linkedActivityIds.map((activityOid) => {
                        const matchedEvent = renderedEvents.find((re) => re.event.oid === activityOid);
                        if (!matchedEvent) return null;

                        const sx = box.x;
                        const sy = box.y + box.height;
                        const tx = matchedEvent.markerX;
                        const ty = matchedEvent.markerY;
                        const midY = (sy + ty) / 2;
                        const cpOffset = Math.min(40, Math.abs(tx - sx) * 0.3);

                        return (
                            <path
                                key={`scenario-link-${box.scenarioOid}-${activityOid}`}
                                d={`M ${sx} ${sy} Q ${sx + cpOffset} ${midY}, ${tx} ${ty}`}
                                stroke={SCENARIO_COLOR}
                                strokeDasharray={SCENARIO_LINK_DASH}
                                strokeOpacity={0.35}
                                strokeWidth={1.5}
                                fill="none"
                            />
                        );
                    });
                })}

                {/* Scenario boxes */}
                {scenarioBoxes && scenarioBoxes.map((box) => {
                    const boxLeft = box.x - (box.width / 2);
                    return (
                        <g key={`scenario-box-${box.scenarioOid}`}>
                            {/* Vertical dashed connector to axis */}
                            <line
                                x1={box.x}
                                x2={box.x}
                                y1={box.y + box.height}
                                y2={geometry.axisY}
                                stroke={SCENARIO_COLOR}
                                strokeDasharray="3 3"
                                strokeOpacity={0.4}
                                strokeWidth={0.75}
                            />
                            {/* Box */}
                            <rect
                                x={boxLeft}
                                y={box.y}
                                width={box.width}
                                height={box.height}
                                rx={6}
                                fill={isLight ? '#ecfeff' : 'rgba(6, 182, 212, 0.1)'}
                                stroke={SCENARIO_COLOR}
                                strokeWidth={1}
                                style={{ cursor: 'pointer' }}
                                onClick={() => onScenarioClick?.(box)}
                                onMouseEnter={(e) => onScenarioHover?.(e, box)}
                                onMouseMove={(e) => onScenarioHover?.(e, box)}
                                onMouseLeave={onClearHover}
                            />
                            {/* Label */}
                            <foreignObject
                                x={boxLeft}
                                y={box.y}
                                width={box.width}
                                height={box.height}
                                style={{ pointerEvents: 'none' }}
                            >
                                <div
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        color: SCENARIO_COLOR,
                                        textTransform: 'capitalize',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        padding: '0 8px',
                                    }}
                                >
                                    {box.label}
                                </div>
                            </foreignObject>
                        </g>
                    );
                })}

                {visibleHeatTypes.map((type, rowIndex) => {
                    const y = geometry.heatTopY + (rowIndex * (geometry.heatRowHeight + geometry.heatRowGap));
                    const color = EVENT_COLORS[type];

                    return heatBins.map((bin) => {
                        const count = getHeatCount(bin, type);
                        const intensity = getHeatIntensity(bin, type);
                        const alpha = count > 0 ? (0.15 + (intensity * 0.82)) : 0.06;
                        const x = geometry.axisStartX + (bin.index * heatBinWidth);
                        const width = Math.max(1, heatBinWidth - 0.25);

                        return (
                            <rect
                                key={`${type}-${bin.index}`}
                                x={x}
                                y={y}
                                width={width}
                                height={geometry.heatRowHeight}
                                rx={1.5}
                                fill={hexToRgba(color, alpha)}
                                data-timeline-drag-region="true"
                                style={{ cursor: 'pointer' }}
                                onMouseEnter={(event) => onHeatHover(event, bin)}
                                onMouseMove={(event) => onHeatHover(event, bin)}
                                onMouseLeave={onClearHover}
                            >
                                <title>{buildHeatTitle(bin, timezone, t)}</title>
                            </rect>
                        );
                    });
                })}

                <line
                    x1={geometry.axisStartX}
                    x2={geometry.axisEndX}
                    y1={geometry.axisY}
                    y2={geometry.axisY}
                    stroke={axisColor}
                    strokeWidth={AXIS_STROKE_WIDTH}
                    data-timeline-drag-region="true"
                />
                <circle
                    cx={geometry.axisStartX}
                    cy={geometry.axisY}
                    r={AXIS_ENDCAP_RADIUS}
                    fill={isLight ? '#ffffff' : '#0f172a'}
                    stroke={axisColor}
                    strokeWidth={1}
                    data-timeline-drag-region="true"
                />
                <circle
                    cx={geometry.axisEndX}
                    cy={geometry.axisY}
                    r={AXIS_ENDCAP_RADIUS}
                    fill={isLight ? '#ffffff' : '#0f172a'}
                    stroke={axisColor}
                    strokeWidth={1}
                    data-timeline-drag-region="true"
                />

                {geometry.ticks.map((tick) => (
                    <g key={`tick-${tick.index}`}>
                        <line
                            x1={tick.x}
                            x2={tick.x}
                            y1={geometry.axisY - TICK_HEIGHT}
                            y2={geometry.axisY}
                            stroke={tickColor}
                            strokeWidth={0.75}
                            data-timeline-drag-region="true"
                        />
                        <foreignObject
                            x={tick.x - (TICK_LABEL_WIDTH / 2)}
                            y={geometry.tickLabelY}
                            width={TICK_LABEL_WIDTH}
                            height={18}
                            data-timeline-drag-region="true"
                        >
                            <div
                                style={{
                                    width: '100%',
                                    fontSize: '11px',
                                    textAlign: 'center',
                                    color: tickLabelColor,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                }}
                            >
                                {tick.label}
                            </div>
                        </foreignObject>
                    </g>
                ))}

                {renderedEvents.map((item) => (
                    <line
                        key={`connector-${item.id}`}
                        x1={item.markerX}
                        x2={item.markerX}
                        y1={item.markerY + MARKER_RADIUS}
                        y2={item.detailTop}
                        stroke={item.color}
                        strokeOpacity={0.5}
                        strokeWidth={0.75}
                    />
                ))}

                {renderedEvents.map((item) => (
                    <circle
                        key={`marker-${item.id}`}
                        cx={item.markerX}
                        cy={item.markerY}
                        r={MARKER_RADIUS}
                        fill={isLight ? '#ffffff' : '#0f172a'}
                        stroke={item.color}
                        strokeWidth={1}
                        style={{ cursor: 'pointer' }}
                        onClick={() => onEventClick(item.event)}
                        onMouseEnter={(event) => onEventHover(event, item.event)}
                        onMouseMove={(event) => onEventHover(event, item.event)}
                        onMouseLeave={onClearHover}
                    >
                        <title>{`${t(`timeline.lanes.${item.event.type}`)} • ${formatExactTimestamp(item.event.createdAt, timezone)}`}</title>
                    </circle>
                ))}
            </svg>

            <div className="absolute inset-0">
                {renderedEvents.map((item) => (
                    <button
                        key={`detail-${item.id}`}
                        type="button"
                        data-timeline-detail-card="true"
                        onClick={() => onEventClick(item.event)}
                        onMouseEnter={(event) => onEventHover(event, item.event)}
                        onMouseMove={(event) => onEventHover(event, item.event)}
                        onMouseLeave={onClearHover}
                        className="absolute text-left"
                        style={{
                            left: `${item.detailLeft}px`,
                            top: `${item.detailTop}px`,
                            width: `${item.detailWidth}px`,
                            minHeight: `${item.detailHeight}px`,
                            borderRadius: '8px',
                            border: `1px solid ${item.color}`,
                            background: isLight ? '#ffffff' : '#0f172a',
                            color: isLight ? '#0f172a' : '#e2e8f0',
                            fontSize: item.event.type === 'interaction' ? '10px' : '11px',
                            lineHeight: 1.2,
                            fontWeight: 500,
                            whiteSpace: 'pre-line',
                            padding: item.event.type === 'interaction' ? '5px 7px' : '6px 8px',
                            boxShadow: isLight
                                ? '0 2px 8px rgba(15, 23, 42, 0.06)'
                                : '0 2px 10px rgba(2, 6, 23, 0.3)',
                            cursor: 'pointer',
                        }}
                    >
                        {item.detailLabel}
                    </button>
                ))}
            </div>

            {hover && (
                <div
                    className={`
                        pointer-events-none absolute z-20 rounded-md border px-2 py-1 text-[11px] font-medium shadow-lg backdrop-blur-sm
                        ${isLight
                            ? 'border-slate-300 bg-white/95 text-slate-800'
                            : 'border-slate-600 bg-slate-900/95 text-slate-100'}
                    `}
                    style={{
                        left: `${hover.x}px`,
                        top: `${hover.y}px`,
                        maxWidth: `${HOVER_TOOLTIP_MAX_WIDTH}px`,
                        whiteSpace: 'pre-line',
                    }}
                >
                    {hover.label}
                </div>
            )}

            <div className={`absolute left-4 bottom-3 text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {formatTickDate(windowState.start, timezone, windowState.durationDays)}
            </div>
            <div className={`absolute right-4 bottom-3 text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {formatTickDate(windowState.end, timezone, windowState.durationDays)}
            </div>
        </div>
    );
}
