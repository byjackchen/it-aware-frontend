'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import type { SurveyQuestionDraft } from './types';
import { createEmptyOptionDraft, createEmptyQuestionDraft } from './utils';

interface SurveyQuestionBuilderProps {
    intro: string;
    onIntroChange: (value: string) => void;
    questions: SurveyQuestionDraft[];
    onQuestionsChange: (questions: SurveyQuestionDraft[]) => void;
    disabled?: boolean;
}

export function SurveyQuestionBuilder({
    intro,
    onIntroChange,
    questions,
    onQuestionsChange,
    disabled = false,
}: SurveyQuestionBuilderProps) {
    const t = useTranslations('CampaignSurvey');
    const { theme } = useTheme();
    const isLight = theme === 'light';

    const updateQuestion = (questionId: string, updater: (question: SurveyQuestionDraft) => SurveyQuestionDraft) => {
        onQuestionsChange(questions.map((question) => {
            if (question.id !== questionId) return question;
            return updater(question);
        }));
    };

    const addQuestion = () => {
        onQuestionsChange([
            ...questions,
            createEmptyQuestionDraft('text'),
        ]);
    };

    const removeQuestion = (questionId: string) => {
        onQuestionsChange(questions.filter((question) => question.id !== questionId));
    };

    return (
        <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
            <div className="space-y-1">
                <h2 className={`text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {t('questionBuilder.title')}
                </h2>
                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    {t('questionBuilder.subtitle')}
                </p>
            </div>

            <div>
                <label className={`block text-sm mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                    {t('questionBuilder.fields.intro')}
                </label>
                <textarea
                    value={intro}
                    onChange={(event) => onIntroChange(event.target.value)}
                    disabled={disabled}
                    rows={3}
                    placeholder={t('questionBuilder.fields.introPlaceholder')}
                    className={`w-full px-3 py-2 rounded-md border resize-y ${isLight ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                />
            </div>

            <div className="space-y-3">
                {questions.length === 0 && (
                    <div className={`rounded-md border border-dashed p-3 text-sm ${isLight ? 'border-slate-300 text-slate-500' : 'border-white/15 text-gray-400'}`}>
                        {t('questionBuilder.empty')}
                    </div>
                )}

                {questions.map((question, questionIndex) => {
                    const questionLabel = `${t('questionBuilder.questionLabel')} #${questionIndex + 1}`;

                    return (
                        <div
                            key={question.id}
                            className={`rounded-lg border p-3 space-y-3 ${isLight ? 'border-slate-200' : 'border-white/10'}`}
                        >
                            <div className="flex items-center justify-between gap-2">
                                <h3 className={`text-sm font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>{questionLabel}</h3>
                                <button
                                    type="button"
                                    onClick={() => removeQuestion(question.id)}
                                    disabled={disabled}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-rose-400/40 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    <span>{t('questionBuilder.actions.removeQuestion')}</span>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                        {t('questionBuilder.fields.questionId')}
                                    </label>
                                    <input
                                        type="text"
                                        value={question.question_id}
                                        onChange={(event) => updateQuestion(question.id, (current) => ({
                                            ...current,
                                            question_id: event.target.value,
                                        }))}
                                        disabled={disabled}
                                        className={`w-full px-2 py-1.5 rounded-md border ${isLight ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                    />
                                </div>

                                <div>
                                    <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                        {t('questionBuilder.fields.type')}
                                    </label>
                                    <select
                                        value={question.type}
                                        onChange={(event) => {
                                            const nextType = event.target.value as SurveyQuestionDraft['type'];
                                            updateQuestion(question.id, (current) => ({
                                                ...current,
                                                type: nextType,
                                                options: nextType === 'text'
                                                    ? []
                                                    : (current.options.length > 0 ? current.options : [createEmptyOptionDraft()]),
                                            }));
                                        }}
                                        disabled={disabled}
                                        className={`w-full px-2 py-1.5 rounded-md border ${isLight ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                    >
                                        <option value="single_select">single_select</option>
                                        <option value="multi_select">multi_select</option>
                                        <option value="text">text</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                        {t('questionBuilder.fields.title')}
                                    </label>
                                    <textarea
                                        value={question.title}
                                        onChange={(event) => updateQuestion(question.id, (current) => ({
                                            ...current,
                                            title: event.target.value,
                                        }))}
                                        disabled={disabled}
                                        rows={3}
                                        className={`w-full px-2 py-1.5 rounded-md border resize-y ${isLight ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                    />
                                </div>
                            </div>

                            <label className={`inline-flex items-center gap-2 text-xs ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                <input
                                    type="checkbox"
                                    checked={question.required}
                                    onChange={(event) => updateQuestion(question.id, (current) => ({
                                        ...current,
                                        required: event.target.checked,
                                    }))}
                                    disabled={disabled}
                                />
                                {t('questionBuilder.fields.required')}
                            </label>

                            {(question.type === 'single_select' || question.type === 'multi_select') && (
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className={`text-xs font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                            {t('questionBuilder.fields.options')}
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => updateQuestion(question.id, (current) => ({
                                                ...current,
                                                options: [...current.options, createEmptyOptionDraft()],
                                            }))}
                                            disabled={disabled}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
                                        >
                                            <Plus className="w-3 h-3" />
                                            <span>{t('questionBuilder.actions.addOption')}</span>
                                        </button>
                                    </div>

                                    {question.options.map((option) => (
                                        <div key={option.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                                            <input
                                                type="text"
                                                value={option.option_id}
                                                onChange={(event) => updateQuestion(question.id, (current) => ({
                                                    ...current,
                                                    options: current.options.map((currentOption) => {
                                                        if (currentOption.id !== option.id) return currentOption;
                                                        return {
                                                            ...currentOption,
                                                            option_id: event.target.value,
                                                        };
                                                    }),
                                                }))}
                                                disabled={disabled}
                                                placeholder={t('questionBuilder.fields.optionId')}
                                                className={`px-2 py-1.5 rounded-md border ${isLight ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                            />
                                            <input
                                                type="text"
                                                value={option.label}
                                                onChange={(event) => updateQuestion(question.id, (current) => ({
                                                    ...current,
                                                    options: current.options.map((currentOption) => {
                                                        if (currentOption.id !== option.id) return currentOption;
                                                        return {
                                                            ...currentOption,
                                                            label: event.target.value,
                                                        };
                                                    }),
                                                }))}
                                                disabled={disabled}
                                                placeholder={t('questionBuilder.fields.optionLabel')}
                                                className={`px-2 py-1.5 rounded-md border ${isLight ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => updateQuestion(question.id, (current) => ({
                                                    ...current,
                                                    options: current.options.filter((currentOption) => currentOption.id !== option.id),
                                                }))}
                                                disabled={disabled || question.options.length <= 1}
                                                className="inline-flex items-center justify-center px-2 rounded-md border border-rose-400/40 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={addQuestion}
                disabled={disabled}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
            >
                <Plus className="w-4 h-4" />
                <span>{t('questionBuilder.actions.addQuestion')}</span>
            </button>
        </section>
    );
}
