'use client';

import type { PersonaActivityEventType } from '@/app/(main)/persona/types';
import { EVENT_COLORS, TIMELINE_TYPES } from './constants';

interface TimelineLegendProps {
    isLight: boolean;
    showInteractions: boolean;
    t: (key: string, values?: Record<string, string | number>) => string;
}

export function TimelineLegend({ isLight, showInteractions, t }: TimelineLegendProps) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <span className={`text-xs font-medium uppercase tracking-wide ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                {t('timeline.legend')}
            </span>
            <span className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                {t('timeline.heatBar')}
            </span>
            {TIMELINE_TYPES.map((type) => {
                const shouldDim = type === 'interaction' && !showInteractions;
                return (
                    <span
                        key={type}
                        className={`inline-flex items-center gap-1.5 text-xs ${isLight ? 'text-slate-700' : 'text-slate-300'} ${shouldDim ? 'opacity-60' : ''}`}
                    >
                        <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: EVENT_COLORS[type as PersonaActivityEventType] }}
                        />
                        {t(`timeline.lanes.${type}`)}
                    </span>
                );
            })}
        </div>
    );
}
