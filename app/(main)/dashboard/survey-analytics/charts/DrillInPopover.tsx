'use client';

import { useRouter } from 'next/navigation';
import type { AnalysisPreview } from '@/lib/types/survey-analytics';

interface DrillInPopoverProps {
    title: string;
    analyses: AnalysisPreview[];
    totalCount: number;
    isLight: boolean;
    position: { x: number; y: number };
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

const SEMANTIC_STYLES: Record<string, { bg: string; text: string }> = {
    positive: { bg: 'bg-green-500/20', text: 'text-green-500' },
    negative: { bg: 'bg-red-500/20', text: 'text-red-500' },
};

export function DrillInPopover({ title, analyses, totalCount, isLight, position, onMouseEnter, onMouseLeave }: DrillInPopoverProps) {
    const router = useRouter();

    return (
        <div
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className="fixed z-50 pointer-events-auto"
            style={{
                left: Math.min(position.x, window.innerWidth - 380),
                top: Math.min(position.y, window.innerHeight - 400),
            }}
        >
            <div
                className={`w-[360px] max-h-[360px] rounded-xl border shadow-2xl overflow-hidden ${isLight
                    ? 'bg-white border-slate-200'
                    : 'bg-slate-900 border-white/10'
                }`}
            >
                {/* Header */}
                <div className={`px-3 py-2 border-b ${isLight ? 'border-slate-100 bg-slate-50' : 'border-white/5 bg-slate-800/50'}`}>
                    <p className={`text-xs font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        {title}
                    </p>
                    <p className={`text-[10px] ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        {totalCount} total · showing {Math.min(analyses.length, 20)}
                    </p>
                </div>

                {/* List */}
                <div className="overflow-y-auto max-h-[310px]">
                    {analyses.map((a) => {
                        const sem = a.semantic ? SEMANTIC_STYLES[a.semantic] : null;
                        return (
                            <div
                                key={a.oid}
                                onClick={() => router.push(`/data/analyses/${a.oid}`)}
                                className={`px-3 py-2 cursor-pointer border-b transition-colors ${isLight
                                    ? 'border-slate-50 hover:bg-blue-50'
                                    : 'border-white/5 hover:bg-white/5'
                                }`}
                            >
                                <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className={`text-xs font-medium shrink-0 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                        {a.topic}
                                    </span>
                                    {sem && (
                                        <span className={`text-[10px] px-1.5 py-0 rounded-full shrink-0 ${sem.bg} ${sem.text}`}>
                                            {a.semantic}
                                        </span>
                                    )}
                                    {a.intent && (
                                        <span className={`text-[10px] px-1.5 py-0 rounded-full shrink-0 ${isLight ? 'bg-slate-100 text-slate-600' : 'bg-white/10 text-gray-400'}`}>
                                            {a.intent}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    {a.worker_stable_id && (
                                        <span className={`text-[10px] font-mono ${isLight ? 'text-blue-600' : 'text-blue-400'}`}>
                                            {a.worker_stable_id}
                                        </span>
                                    )}
                                    {a.fact && (
                                        <span className={`text-[11px] line-clamp-1 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                            {a.worker_stable_id ? '· ' : ''}{a.fact}
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
