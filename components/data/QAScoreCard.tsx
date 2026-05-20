'use client';

/**
 * QA Score Card — displays the LLM-generated quality assessment for an incident.
 * Shows total score, category breakdowns with progress bars, and expandable
 * per-item scores with reasons.
 */

import { useState } from 'react';
import { ChevronDown, ChevronRight, Award } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import type { QAScoreDetail, QAScoreItem } from '@/lib/types/objects';

interface QAScoreCardProps {
    score: number | null | undefined;
    detail: QAScoreDetail | null | undefined;
    scoredAt: string | null | undefined;
}

// Category display config
const CATEGORIES = [
    { key: 'ticket_management', label: 'Ticket Management', max: 35, color: 'blue' },
    { key: 'policies_procedures', label: 'Policies & Procedures', max: 30, color: 'purple' },
    { key: 'problem_determination', label: 'Problem Determination & Resolution', max: 20, color: 'amber' },
    { key: 'soft_skills', label: 'Soft Skills', max: 15, color: 'emerald' },
] as const;

// Item labels for display
const ITEM_LABELS: Record<string, string> = {
    ticket_category: 'Ticket Category',
    impact_urgency_priority: 'Impact / Urgency / Priority',
    work_note: 'Work Note',
    caller_info: 'Caller Information',
    resolution_code: 'Resolution Code',
    kb_number: 'KB Number',
    response_script: 'Standard Response Script',
    sop_adherence: 'SOP Adherence',
    ownership: 'Ownership',
    follow_up: 'Follow Up',
    resolution_sla: 'Resolution SLA',
    understand_issue: 'Understand Issue',
    probing_questions: 'Probing Questions',
    gather_info: 'Gather Key Information',
    accurate_resolution: 'Accurate Resolution',
    polite_professional: 'Polite & Professional',
    simple_language: 'Simple Language',
    user_understands: 'User Understands',
};

function getScoreColor(score: number, max: number): string {
    const pct = score / max;
    if (pct >= 0.8) return 'text-emerald-500';
    if (pct >= 0.6) return 'text-amber-500';
    if (pct >= 0.4) return 'text-orange-500';
    return 'text-red-500';
}

function getBarColor(score: number, max: number): string {
    const pct = score / max;
    if (pct >= 0.8) return 'bg-emerald-500';
    if (pct >= 0.6) return 'bg-amber-500';
    if (pct >= 0.4) return 'bg-orange-500';
    return 'bg-red-500';
}

function getTotalBadgeStyle(score: number): { bg: string; text: string } {
    if (score >= 80) return { bg: 'bg-emerald-500/20', text: 'text-emerald-500' };
    if (score >= 60) return { bg: 'bg-amber-500/20', text: 'text-amber-500' };
    if (score >= 40) return { bg: 'bg-orange-500/20', text: 'text-orange-500' };
    return { bg: 'bg-red-500/20', text: 'text-red-500' };
}

function isQAScoreItem(value: unknown): value is QAScoreItem {
    return (
        typeof value === 'object' &&
        value !== null &&
        'score' in value &&
        'reason' in value
    );
}

export function QAScoreCard({ score, detail, scoredAt }: QAScoreCardProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    function toggleCategory(key: string) {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    }

    // No score yet
    if (score == null && detail == null) {
        return (
            <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-center gap-2 mb-2">
                    <Award className={`w-5 h-5 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                    <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        QA Score
                    </h2>
                </div>
                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    Not yet scored. QA scoring runs automatically for resolved/closed incidents.
                </p>
            </div>
        );
    }

    const totalScore = score ?? detail?.total_score ?? 0;
    const badge = getTotalBadgeStyle(totalScore);

    return (
        <div className={`rounded-xl border p-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Award className={`w-5 h-5 ${isLight ? 'text-slate-600' : 'text-gray-300'}`} />
                    <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>
                        QA Score
                    </h2>
                </div>
                <div className="flex items-center gap-3">
                    {scoredAt && (
                        <span className={`text-xs ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                            Scored {formatDateTime(scoredAt, timezone)}
                        </span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-lg font-bold ${badge.bg} ${badge.text}`}>
                        {totalScore}/100
                    </span>
                </div>
            </div>

            {/* Category Breakdowns */}
            <div className="space-y-3">
                {CATEGORIES.map(({ key, label, max }) => {
                    const catData = detail?.[key as keyof QAScoreDetail];
                    const catScore = (catData && typeof catData === 'object' && 'score' in catData)
                        ? (catData as { score: number }).score
                        : 0;
                    const isExpanded = expandedCategories.has(key);
                    const pct = max > 0 ? (catScore / max) * 100 : 0;

                    return (
                        <div key={key}>
                            {/* Category row */}
                            <button
                                onClick={() => toggleCategory(key)}
                                className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors ${
                                    isLight
                                        ? 'hover:bg-slate-50'
                                        : 'hover:bg-white/5'
                                }`}
                            >
                                {isExpanded
                                    ? <ChevronDown className="w-4 h-4 shrink-0 opacity-50" />
                                    : <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />
                                }
                                <span className={`text-sm font-medium flex-1 text-left ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                    {label}
                                </span>
                                <span className={`text-sm font-semibold tabular-nums ${getScoreColor(catScore, max)}`}>
                                    {catScore}/{max}
                                </span>
                                {/* Progress bar */}
                                <div className={`w-24 h-2 rounded-full overflow-hidden ${isLight ? 'bg-slate-100' : 'bg-white/10'}`}>
                                    <div
                                        className={`h-full rounded-full transition-all ${getBarColor(catScore, max)}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </button>

                            {/* Expanded items */}
                            {isExpanded && catData && typeof catData === 'object' && (
                                <div className={`ml-8 mt-1 mb-2 space-y-1.5 border-l-2 pl-3 ${
                                    isLight ? 'border-slate-200' : 'border-white/10'
                                }`}>
                                    {Object.entries(catData).map(([itemKey, itemValue]) => {
                                        if (itemKey === 'score' || itemKey === 'max') return null;
                                        if (!isQAScoreItem(itemValue)) return null;

                                        const itemLabel = ITEM_LABELS[itemKey] || itemKey;
                                        const itemMax = itemKey === 'kb_number' ? 10
                                            : itemKey === 'sop_adherence' ? 10
                                            : 5;

                                        return (
                                            <div key={itemKey} className="flex items-start gap-2">
                                                <span className={`text-xs font-medium w-40 shrink-0 pt-0.5 ${
                                                    isLight ? 'text-slate-600' : 'text-gray-300'
                                                }`}>
                                                    {itemLabel}
                                                </span>
                                                <span className={`text-xs font-bold tabular-nums w-8 shrink-0 pt-0.5 ${
                                                    getScoreColor(itemValue.score, itemMax)
                                                }`}>
                                                    {itemValue.score}/{itemMax}
                                                </span>
                                                <span className={`text-xs flex-1 ${
                                                    isLight ? 'text-slate-500' : 'text-gray-400'
                                                }`}>
                                                    {itemValue.reason}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
