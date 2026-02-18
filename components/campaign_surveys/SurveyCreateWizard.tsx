'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { createCampaignSurveyAction } from '@/app/actions/campaigns';
import type { SurveyDetailCreate } from '@/lib/types/objects';
import { CampaignReceiverSelector } from '@/components/campaign_shared/CampaignReceiverSelector';
import { SurveyQuestionBuilder } from './SurveyQuestionBuilder';
import { SurveyDirectSpreadsheetCreate } from './SurveyDirectSpreadsheetCreate';
import {
    createEmptyQuestionDraft,
    makeDraftId,
    toSurveyQuestions,
    validateSurveyQuestions,
} from './utils';
import type { SurveyCreateEntryMode } from './types';
import { useAllActiveWorkers } from './useAllActiveWorkers';
import { upsertSurveyDetailsInBatches, type SurveyDetailBatchProgress } from './detailBatchWriter';

export function SurveyCreateWizard() {
    const t = useTranslations('CampaignSurvey');
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';

    const [isPending, startTransition] = useTransition();
    const [createMode, setCreateMode] = useState<SurveyCreateEntryMode>('guided');
    const [name, setName] = useState('');
    const [intro, setIntro] = useState('');
    const [questions, setQuestions] = useState([
        {
            ...createEmptyQuestionDraft('text'),
            id: makeDraftId(),
        },
    ]);
    const [selectedReceiverStableIds, setSelectedReceiverStableIds] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [batchProgress, setBatchProgress] = useState<SurveyDetailBatchProgress | null>(null);

    const {
        workers,
        isLoading: isWorkersLoading,
        error: workersError,
    } = useAllActiveWorkers();

    const allWorkerStableIds = useMemo(
        () => workers.map((worker) => worker.stable_id),
        [workers]
    );

    const questionValidationError = useMemo(
        () => validateSurveyQuestions(toSurveyQuestions(intro, questions)),
        [intro, questions]
    );

    const handleGuidedSubmit = () => {
        setError(null);
        setBatchProgress(null);

        if (name.trim().length === 0) {
            setError(t('create.errors.emptyName'));
            return;
        }

        if (questionValidationError) {
            setError(questionValidationError);
            return;
        }

        if (selectedReceiverStableIds.length === 0) {
            setError(t('create.errors.noReceivers'));
            return;
        }

        const surveyQuestions = toSurveyQuestions(intro, questions);

        startTransition(async () => {
            const createResult = await createCampaignSurveyAction({
                name: name.trim(),
                survey_questions: surveyQuestions,
            });

            if (!createResult.success) {
                setError(createResult.error);
                return;
            }

            const surveyOid = createResult.data.oid;
            const details: SurveyDetailCreate[] = selectedReceiverStableIds.map((stableId) => ({
                receiver_stable_id: stableId,
                status: 'created',
            }));

            const upsertResult = await upsertSurveyDetailsInBatches(surveyOid, details, setBatchProgress);
            if (!upsertResult.success) {
                setError(t('create.errors.partialWrite', {
                    surveyOid,
                    processed: upsertResult.processedRows,
                    total: upsertResult.totalRows,
                    error: upsertResult.error,
                }));
                return;
            }

            router.push(`/campaign/surveys?survey=${encodeURIComponent(surveyOid)}`);
            router.refresh();
        });
    };

    return (
        <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push('/campaign/surveys')}
                        className={`p-2 rounded-lg ${isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-gray-300'}`}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className={`text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t('create.title')}</h1>
                        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('create.subtitle')}</p>
                    </div>
                </div>

                <div className="inline-flex rounded-lg border border-white/10 p-1">
                    <button
                        type="button"
                        onClick={() => {
                            setCreateMode('guided');
                            setSelectedReceiverStableIds([]);
                            setError(null);
                            setBatchProgress(null);
                        }}
                        className={`px-3 py-1.5 text-sm rounded-md ${createMode === 'guided' ? 'bg-blue-500 text-white' : isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-gray-300 hover:bg-white/10'}`}
                    >
                        {t('create.entryModes.guided')}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setCreateMode('spreadsheet');
                            setSelectedReceiverStableIds([]);
                            setError(null);
                            setBatchProgress(null);
                        }}
                        className={`px-3 py-1.5 text-sm rounded-md ${createMode === 'spreadsheet' ? 'bg-blue-500 text-white' : isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-gray-300 hover:bg-white/10'}`}
                    >
                        {t('create.entryModes.spreadsheet')}
                    </button>
                </div>

                {error && (
                    <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                        {error}
                    </div>
                )}

                {createMode === 'guided' ? (
                    <>
                        <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                            <h2 className={`text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t('create.sections.questions')}</h2>
                            <div>
                                <label className={`block text-sm mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('create.fields.name')}</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    placeholder={t('create.fields.namePlaceholder')}
                                    className={`w-full px-3 py-2 rounded-md border ${isLight ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                />
                            </div>

                            <SurveyQuestionBuilder
                                intro={intro}
                                onIntroChange={setIntro}
                                questions={questions}
                                onQuestionsChange={setQuestions}
                                disabled={isPending}
                            />
                        </section>

                        <CampaignReceiverSelector
                            namespace="CampaignSurvey"
                            sectionTitle={t('create.sections.receivers')}
                            isLight={isLight}
                            workers={workers}
                            isWorkersLoading={isWorkersLoading}
                            workersError={workersError}
                            onSelectionChange={setSelectedReceiverStableIds}
                            onErrorChange={setError}
                        />

                        <div className="flex items-center justify-end gap-3">
                            {batchProgress && isPending && (
                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                    {t('batchProgress', {
                                        processed: batchProgress.processedRows,
                                        total: batchProgress.totalRows,
                                        currentBatch: batchProgress.currentBatch,
                                        totalBatches: batchProgress.totalBatches,
                                    })}
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={handleGuidedSubmit}
                                disabled={isPending}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                <span>{t('create.actions.create')}</span>
                            </button>
                        </div>
                    </>
                ) : (
                    <SurveyDirectSpreadsheetCreate
                        validStableIds={allWorkerStableIds}
                        isWorkersLoading={isWorkersLoading}
                        workersError={workersError}
                    />
                )}
            </div>
        </div>
    );
}
