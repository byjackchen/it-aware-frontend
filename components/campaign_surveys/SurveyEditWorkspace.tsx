'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import {
    deleteCampaignSurveyDetailAction,
    updateCampaignSurveyAction,
} from '@/app/actions/campaigns';
import type {
    Survey,
    SurveyDetail,
    SurveyDetailCreate,
    SurveyQuestions,
} from '@/lib/types/objects';
import { SurveyAccessGate } from './SurveyAccessGate';
import { SurveyQuestionBuilder } from './SurveyQuestionBuilder';
import {
    createEmptyQuestionDraft,
    draftFromQuestion,
    parseSurveyAnswerJson,
    stringifySurveyAnswer,
    toSurveyQuestions,
    validateSurveyAnswerPayload,
    validateSurveyQuestions,
} from './utils';
import { useAllActiveWorkers } from './useAllActiveWorkers';
import { upsertSurveyDetailsInBatches } from './detailBatchWriter';

interface SurveyEditWorkspaceProps {
    survey: Survey;
    details: SurveyDetail[];
}

interface EditableRow {
    receiver_stable_id: string;
    status: SurveyDetail['status'];
    submitted_at: string | null;
    survey_answer_text: string;
    isNew: boolean;
}

function formatDateTime(value: string | null): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
}

function toDateTimeInputValue(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
}

function fromDateTimeInputValue(value: string): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
}

export function SurveyEditWorkspace({ survey, details }: SurveyEditWorkspaceProps) {
    const t = useTranslations('CampaignSurvey');
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';

    const [isPending, startTransition] = useTransition();

    const [name, setName] = useState(survey.name);
    const [intro, setIntro] = useState(survey.survey_questions.intro);
    const [questions, setQuestions] = useState(
        survey.survey_questions.questions.length > 0
            ? survey.survey_questions.questions.map(draftFromQuestion)
            : [createEmptyQuestionDraft('text')]
    );
    const [rows, setRows] = useState<EditableRow[]>(
        details.map((detail) => ({
            receiver_stable_id: detail.receiver_stable_id,
            status: detail.status,
            submitted_at: detail.submitted_at,
            survey_answer_text: stringifySurveyAnswer(detail.survey_answer),
            isNew: false,
        }))
    );
    const [removedExistingStableIds, setRemovedExistingStableIds] = useState<string[]>([]);
    const [newReceiverStableId, setNewReceiverStableId] = useState('');
    const [error, setError] = useState<string | null>(null);

    const {
        workers,
        isLoading: isWorkersLoading,
    } = useAllActiveWorkers();

    const isQuestionEditable = survey.status === 'created';
    const isDetailsEditable = survey.status !== 'cancelled';
    const isNameEditable = survey.status !== 'cancelled';

    const initialStableIdSet = useMemo(
        () => new Set(details.map((detail) => detail.receiver_stable_id)),
        [details]
    );

    const workerStableIdSet = useMemo(
        () => new Set(workers.map((worker) => worker.stable_id)),
        [workers]
    );

    const handleRemoveReceiver = (receiverStableId: string) => {
        setRows((current) => current.filter((row) => row.receiver_stable_id !== receiverStableId));
        if (initialStableIdSet.has(receiverStableId)) {
            setRemovedExistingStableIds((current) => {
                if (current.includes(receiverStableId)) return current;
                return [...current, receiverStableId];
            });
        }
    };

    const handleAddReceiver = () => {
        const stableId = newReceiverStableId.trim();
        if (!stableId) return;
        if (rows.some((row) => row.receiver_stable_id === stableId)) {
            setError(t('edit.errors.duplicateReceiver'));
            return;
        }

        if (workers.length > 0 && !workerStableIdSet.has(stableId)) {
            setError(t('edit.errors.receiverNotFound'));
            return;
        }

        setRows((current) => [
            ...current,
            {
                receiver_stable_id: stableId,
                status: 'created',
                submitted_at: null,
                survey_answer_text: '',
                isNew: true,
            },
        ]);
        setNewReceiverStableId('');
        setError(null);
    };

    const handleSave = () => {
        setError(null);

        if (!isNameEditable && !isDetailsEditable) {
            setError(t('edit.errors.notEditable'));
            return;
        }

        if (name.trim().length === 0) {
            setError(t('edit.errors.emptyName'));
            return;
        }

        let surveyQuestions: SurveyQuestions = survey.survey_questions;
        if (isQuestionEditable) {
            surveyQuestions = toSurveyQuestions(intro, questions);
            const questionError = validateSurveyQuestions(surveyQuestions);
            if (questionError) {
                setError(questionError);
                return;
            }
        }

        if (rows.length === 0) {
            setError(t('edit.errors.noReceivers'));
            return;
        }

        const receiverSet = new Set<string>();
        const detailPayloads: SurveyDetailCreate[] = [];

        for (const row of rows) {
            const receiverStableId = row.receiver_stable_id.trim();
            if (receiverStableId.length === 0) {
                setError(t('edit.errors.emptyReceiver'));
                return;
            }
            if (receiverSet.has(receiverStableId)) {
                setError(t('edit.errors.duplicateReceiver'));
                return;
            }
            receiverSet.add(receiverStableId);

            if (row.status === 'submitted') {
                if (!row.submitted_at) {
                    setError(t('edit.errors.submittedAtRequired'));
                    return;
                }

                let answerPayload;
                try {
                    answerPayload = parseSurveyAnswerJson(row.survey_answer_text);
                } catch (parseError) {
                    setError(parseError instanceof Error ? parseError.message : t('edit.errors.invalidAnswerJson'));
                    return;
                }

                if (!answerPayload) {
                    setError(t('edit.errors.answerRequired'));
                    return;
                }

                const answerError = validateSurveyAnswerPayload(surveyQuestions, answerPayload);
                if (answerError) {
                    setError(answerError);
                    return;
                }

                detailPayloads.push({
                    receiver_stable_id: receiverStableId,
                    status: 'submitted',
                    submitted_at: row.submitted_at,
                    survey_answer: answerPayload,
                });
                continue;
            }

            detailPayloads.push({
                receiver_stable_id: receiverStableId,
                status: 'created',
                submitted_at: null,
                survey_answer: null,
            });
        }

        startTransition(async () => {
            const updatePayload = isQuestionEditable
                ? { name: name.trim(), survey_questions: surveyQuestions }
                : { name: name.trim() };

            const updated = await updateCampaignSurveyAction(survey.oid, updatePayload);
            if (!updated.success) {
                setError(updated.error);
                return;
            }

            if (isDetailsEditable) {
                for (const receiverStableId of removedExistingStableIds) {
                    const deleted = await deleteCampaignSurveyDetailAction(survey.oid, receiverStableId);
                    if (!deleted.success) {
                        setError(deleted.error);
                        return;
                    }
                }

                const upsertResult = await upsertSurveyDetailsInBatches(survey.oid, detailPayloads);

                if (!upsertResult.success) {
                    setError(t('edit.errors.partialWrite', {
                        surveyOid: survey.oid,
                        processed: upsertResult.processedRows,
                        total: upsertResult.totalRows,
                        error: upsertResult.error,
                    }));
                    return;
                }
            }

            router.push(`/campaign/surveys?survey=${encodeURIComponent(survey.oid)}`);
            router.refresh();
        });
    };

    return (
        <SurveyAccessGate requireWrite>
            <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
                <div className="max-w-6xl mx-auto space-y-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.push(`/campaign/surveys?survey=${encodeURIComponent(survey.oid)}`)}
                            className={`p-2 rounded-lg ${isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-gray-300'}`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                            <h1 className={`text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t('edit.title')}</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{survey.oid}</p>
                        </div>
                    </div>

                    {!isQuestionEditable && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
                            {t('edit.readOnlyQuestionStatus', { status: survey.status })}
                        </div>
                    )}

                    {!isDetailsEditable && (
                        <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                            {t('edit.readOnlyDetailStatus', { status: survey.status })}
                        </div>
                    )}

                    <section className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                            <div>
                                <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.creator')}</p>
                                <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{survey.creator_account || '—'}</p>
                            </div>
                            <div>
                                <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.status')}</p>
                                <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{survey.status}</p>
                            </div>
                            <div>
                                <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.createdAt')}</p>
                                <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(survey.created_at)}</p>
                            </div>
                            <div>
                                <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.updatedAt')}</p>
                                <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(survey.updated_at)}</p>
                            </div>
                        </div>
                    </section>

                    {error && (
                        <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                            {error}
                        </div>
                    )}

                    <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <div>
                            <label className={`block text-sm mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('edit.fields.name')}</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                disabled={!isNameEditable || isPending}
                                className={`w-full px-3 py-2 rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                            />
                        </div>

                        <SurveyQuestionBuilder
                            intro={intro}
                            onIntroChange={setIntro}
                            questions={questions}
                            onQuestionsChange={setQuestions}
                            disabled={!isQuestionEditable || isPending}
                        />
                    </section>

                    <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <div className="flex items-center justify-between gap-2">
                            <h2 className={`text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t('edit.receiversTitle')}</h2>
                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('edit.receiverCount', { count: rows.length })}</p>
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newReceiverStableId}
                                onChange={(event) => setNewReceiverStableId(event.target.value)}
                                disabled={!isDetailsEditable || isPending}
                                placeholder={t('edit.fields.newReceiverStableId')}
                                className={`flex-1 px-3 py-2 rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                            />
                            <button
                                type="button"
                                onClick={handleAddReceiver}
                                disabled={!isDetailsEditable || isPending}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20 disabled:opacity-60"
                            >
                                <Plus className="w-4 h-4" />
                                <span>{t('edit.actions.addReceiver')}</span>
                            </button>
                        </div>

                        {isWorkersLoading && (
                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('receivers.loadingWorkers')}</p>
                        )}

                        <div className="max-h-[32rem] overflow-y-auto pr-1 space-y-3">
                            {rows.map((row) => (
                                <div key={row.receiver_stable_id} className={`rounded-lg border p-3 space-y-3 ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <p className={`text-sm font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>{row.receiver_stable_id}</p>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveReceiver(row.receiver_stable_id)}
                                            disabled={!isDetailsEditable || isPending}
                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-rose-400/40 text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            <span>{t('edit.actions.removeReceiver')}</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('edit.fields.detailStatus')}</label>
                                            <select
                                                value={row.status}
                                                onChange={(event) => {
                                                    const nextStatus = event.target.value as SurveyDetail['status'];
                                                    setRows((current) => current.map((currentRow) => {
                                                        if (currentRow.receiver_stable_id !== row.receiver_stable_id) return currentRow;
                                                        if (nextStatus === 'created') {
                                                            return {
                                                                ...currentRow,
                                                                status: 'created',
                                                                submitted_at: null,
                                                                survey_answer_text: '',
                                                            };
                                                        }
                                                        return {
                                                            ...currentRow,
                                                            status: 'submitted',
                                                        };
                                                    }));
                                                }}
                                                disabled={!isDetailsEditable || isPending}
                                                className={`w-full px-2 py-1.5 rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                            >
                                                <option value="created">created</option>
                                                <option value="submitted">submitted</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('edit.fields.submittedAt')}</label>
                                            <input
                                                type="datetime-local"
                                                value={toDateTimeInputValue(row.submitted_at)}
                                                onChange={(event) => {
                                                    const nextValue = fromDateTimeInputValue(event.target.value);
                                                    setRows((current) => current.map((currentRow) => {
                                                        if (currentRow.receiver_stable_id !== row.receiver_stable_id) return currentRow;
                                                        return {
                                                            ...currentRow,
                                                            submitted_at: nextValue,
                                                        };
                                                    }));
                                                }}
                                                disabled={!isDetailsEditable || isPending || row.status !== 'submitted'}
                                                className={`w-full px-2 py-1.5 rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('edit.fields.answerJson')}</label>
                                        <textarea
                                            rows={6}
                                            value={row.survey_answer_text}
                                            onChange={(event) => {
                                                setRows((current) => current.map((currentRow) => {
                                                    if (currentRow.receiver_stable_id !== row.receiver_stable_id) return currentRow;
                                                    return {
                                                        ...currentRow,
                                                        survey_answer_text: event.target.value,
                                                    };
                                                }));
                                            }}
                                            disabled={!isDetailsEditable || isPending || row.status !== 'submitted'}
                                            placeholder={t('edit.fields.answerJsonPlaceholder')}
                                            className={`w-full px-2 py-1.5 rounded-md border font-mono text-xs ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isPending || (!isNameEditable && !isDetailsEditable)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
                        >
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>{t('edit.actions.save')}</span>
                        </button>
                    </div>
                </div>
            </div>
        </SurveyAccessGate>
    );
}
