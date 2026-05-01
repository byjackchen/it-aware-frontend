'use client';

/**
 * Survey detail page client component. Read-only.
 */

import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
    ArrowLeft,
    FileSearch,
    User,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import type { Survey, SurveyBatch, Worker, SurveyAnswer } from '@/lib/types/objects';

interface SurveyDetailPageProps {
    survey: Survey;
    surveyBatch: SurveyBatch;
    workers: Worker[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    not_started: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
    submitted: { bg: 'bg-green-500/20', text: 'text-green-500' },
    revoked: { bg: 'bg-orange-500/20', text: 'text-orange-500' },
    expired: { bg: 'bg-red-500/20', text: 'text-red-500' },
};

function renderAnswer(answer: SurveyAnswer, questions: Survey['survey_questions']): string {
    const question = questions.questions.find(q => q.question_id === answer.question_id);
    if (!question) return '—';

    switch (answer.type) {
        case 'single_select': {
            if ('options' in question) {
                const option = question.options.find(o => o.option_id === answer.selected_option_id);
                return option?.label || answer.selected_option_id;
            }
            return answer.selected_option_id;
        }
        case 'multi_select': {
            if ('options' in question) {
                return answer.selected_option_ids
                    .map(id => question.options.find(o => o.option_id === id)?.label || id)
                    .join(', ');
            }
            return answer.selected_option_ids.join(', ');
        }
        case 'text':
            return answer.text;
        default:
            return '—';
    }
}

export function SurveyDetailPage({ survey, surveyBatch, workers }: SurveyDetailPageProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useTransitionRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';

    const receiver = workers.find((w) => w.oid === survey.receiver_oid);
    const statusStyle = STATUS_COLORS[survey.status] || STATUS_COLORS.not_started;

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/data/surveys')} className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-indigo-100 text-indigo-600' : 'bg-indigo-500/20 text-indigo-400'}`}>
                                <FileSearch className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('surveys.detail')}</h1>
                                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {survey.receiver_stable_id}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                        {survey.status.replace(/_/g, ' ')}
                    </div>
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Batch */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('surveys.batch')}</label>
                        <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            {surveyBatch.name} <span className="opacity-50">({surveyBatch.status})</span>
                        </div>
                    </div>

                    {/* Receiver */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('surveys.receiver')}</label>
                        <div className={`flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                            <User className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                            {receiver ? (
                                <Link href={`/data/workers/${receiver.stable_id}`} className="underline underline-offset-4">
                                    {receiver.fullname} ({survey.receiver_stable_id})
                                </Link>
                            ) : (
                                <span>{survey.receiver_stable_id}</span>
                            )}
                        </div>
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Created At</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(survey.created_at, timezone)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Updated At</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(survey.updated_at, timezone)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">{t('surveys.submittedAt')}</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                {survey.submitted_at ? formatDateTime(survey.submitted_at, timezone) : '—'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Questions & Answers */}
                <div className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('surveys.questions')} & {t('surveys.answers')}</h2>

                    {survey.survey_questions.intro && (
                        <div className={`p-3 rounded-lg italic ${isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/5 text-gray-400'}`}>
                            {survey.survey_questions.intro}
                        </div>
                    )}

                    <div className="space-y-4">
                        {survey.survey_questions.questions.map((question, idx) => {
                            const answer = survey.survey_answer?.answers.find(a => a.question_id === question.question_id);
                            return (
                                <div key={question.question_id} className={`p-4 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                                    <div className={`text-sm font-medium mb-1 ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                        Q{idx + 1}. {question.title}
                                        {question.required && <span className="text-red-500 ml-1">*</span>}
                                    </div>
                                    <div className={`text-xs mb-2 ${isLight ? 'text-slate-400' : 'text-gray-500'}`}>
                                        {question.type.replace(/_/g, ' ')}
                                    </div>
                                    <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                        {answer ? (
                                            <span className="font-medium">{renderAnswer(answer, survey.survey_questions)}</span>
                                        ) : (
                                            <span className="italic opacity-50">{t('surveys.noAnswer')}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
