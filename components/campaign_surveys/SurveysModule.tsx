'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ClipboardCheck, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { usePermissions } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';
import type {
    Survey,
    SurveyAnswerPayload,
    SurveyBatch,
    SurveyBatchListResponse,
    SurveyBatchStatus,
    SurveyQuestions,
    SurveyStatus,
} from '@/lib/types/objects';
import {
    createCampaignSurveyAction,
    updateCampaignSurveyAction,
    updateCampaignSurveyBatchAction,
    deleteCampaignSurveyAction,
} from '@/app/actions/campaigns';
import { PaneQuickScrollButtons } from '@/components/campaign_shared';
import { SurveyAccessGate } from './SurveyAccessGate';
import { SurveyQuestionBuilder } from './SurveyQuestionBuilder';
import type { SurveyQuestionDraft } from './types';
import {
    createEmptyQuestionDraft,
    draftFromQuestion,
    getSurveyBatchStatusClass,
    getSurveyStatusClass,
    parseSurveyAnswerJson,
    stringifySurveyAnswer,
    summarizeSurveyAnswer,
    toSurveyQuestions,
    validateSurveyAnswerPayload,
    validateSurveyQuestions,
} from './utils';

interface SurveyChildListResponse {
    items: Survey[];
    total: number;
    skip: number;
    limit: number;
}

const LIST_PAGE_SIZE = 300;
const LIST_SCROLL_LOAD_THRESHOLD = 160;
const DETAILS_PAGE_SIZE = 500;
const DETAILS_SCROLL_LOAD_THRESHOLD = 160;

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

function toQuestionDrafts(surveyQuestions: SurveyQuestions): SurveyQuestionDraft[] {
    if (!Array.isArray(surveyQuestions.questions) || surveyQuestions.questions.length === 0) {
        return [createEmptyQuestionDraft('text')];
    }

    return surveyQuestions.questions.map(draftFromQuestion);
}

function fallbackSurveyQuestions(): SurveyQuestions {
    return {
        intro: '',
        questions: [],
    };
}

export function SurveysModule() {
    const t = useTranslations('CampaignSurvey');
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { hasPermission } = usePermissions();
    const canWrite = hasPermission(PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE);

    const [isObjectSaving, startObjectSavingTransition] = useTransition();
    const [isRowSaving, startRowSavingTransition] = useTransition();
    const [isRowDeleting, startRowDeletingTransition] = useTransition();

    const [statusFilter, setStatusFilter] = useState<SurveyBatchStatus | ''>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [detailsStatusFilter, setDetailsStatusFilter] = useState<SurveyStatus | ''>('');
    const [detailsSearch, setDetailsSearch] = useState('');

    const [surveyBatches, setSurveyBatches] = useState<SurveyBatch[]>([]);
    const [surveysTotal, setSurveysTotal] = useState<number>(0);
    const [isSurveysLoading, setIsSurveysLoading] = useState(false);
    const [isSurveysLoadingMore, setIsSurveysLoadingMore] = useState(false);
    const [hasMoreSurveys, setHasMoreSurveys] = useState(true);
    const [surveysError, setSurveysError] = useState<string | null>(null);

    const [details, setDetails] = useState<Survey[]>([]);
    const [detailsTotal, setDetailsTotal] = useState<number>(0);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [isDetailsLoadingMore, setIsDetailsLoadingMore] = useState(false);
    const [hasMoreDetails, setHasMoreDetails] = useState(true);
    const [detailsError, setDetailsError] = useState<string | null>(null);

    const [selectedSurveyOid, setSelectedSurveyOid] = useState<string | null>(null);

    const [isObjectEditing, setIsObjectEditing] = useState(false);
    const [objectName, setObjectName] = useState('');
    const [objectError, setObjectError] = useState<string | null>(null);

    const [isRowEditorOpen, setIsRowEditorOpen] = useState(false);
    const [rowEditorMode, setRowEditorMode] = useState<'create' | 'edit'>('edit');
    const [editingSurveyOid, setEditingSurveyOid] = useState<string | null>(null);
    const [rowReceiverStableId, setRowReceiverStableId] = useState('');
    const [rowIntro, setRowIntro] = useState('');
    const [rowQuestions, setRowQuestions] = useState<SurveyQuestionDraft[]>([createEmptyQuestionDraft('text')]);
    const [rowStatus, setRowStatus] = useState<SurveyStatus>('created');
    const [rowSubmittedAt, setRowSubmittedAt] = useState('');
    const [rowAnswerText, setRowAnswerText] = useState('');
    const [rowCreatedAt, setRowCreatedAt] = useState<string | null>(null);
    const [rowUpdatedAt, setRowUpdatedAt] = useState<string | null>(null);
    const [rowError, setRowError] = useState<string | null>(null);

    const surveysListRef = useRef<HTMLDivElement>(null);
    const surveyDetailsListRef = useRef<HTMLDivElement>(null);

    const selectedSurveyBatchOid = searchParams.get('surveyBatch');

    const setQueryParam = useCallback((key: string, value: string | null) => {
        const params = new URLSearchParams(searchParams.toString());
        if (!value) {
            params.delete(key);
        } else {
            params.set(key, value);
        }

        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [pathname, router, searchParams]);

    const fetchSurveysPage = useCallback(async (skip: number, replace: boolean) => {
        if (replace) {
            setIsSurveysLoading(true);
        } else {
            setIsSurveysLoadingMore(true);
        }
        setSurveysError(null);

        try {
            const params = new URLSearchParams();
            params.set('limit', String(LIST_PAGE_SIZE));
            params.set('skip', String(skip));
            if (statusFilter) params.set('status', statusFilter);

            const response = await fetch(`/api/campaigns/survey_batchs?${params.toString()}`, {
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error(t('errors.loadSurveys'));
            }

            const payload = (await response.json()) as SurveyBatchListResponse;
            const pageItems = Array.isArray(payload.items) ? payload.items : [];

            setSurveyBatches((current) => {
                const base = replace ? [] : current;
                const seen = new Set(base.map((item) => item.oid));
                const additions = pageItems.filter((item) => {
                    if (seen.has(item.oid)) return false;
                    seen.add(item.oid);
                    return true;
                });
                const next = [...base, ...additions];
                const nextTotal = payload.total ?? next.length;
                const nextHasMore = typeof payload.total === 'number'
                    ? next.length < payload.total
                    : pageItems.length >= LIST_PAGE_SIZE;

                setSurveysTotal(nextTotal);
                setHasMoreSurveys(nextHasMore);

                return next;
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : t('errors.loadSurveys');
            setSurveysError(message);
            if (replace) {
                setSurveyBatches([]);
                setSurveysTotal(0);
                setHasMoreSurveys(true);
            }
        } finally {
            if (replace) {
                setIsSurveysLoading(false);
            } else {
                setIsSurveysLoadingMore(false);
            }
        }
    }, [statusFilter, t]);

    const reloadSurveys = useCallback(async () => {
        setHasMoreSurveys(true);
        await fetchSurveysPage(0, true);
    }, [fetchSurveysPage]);

    const loadMoreSurveys = useCallback(async () => {
        if (isSurveysLoading || isSurveysLoadingMore || !hasMoreSurveys) return;
        await fetchSurveysPage(surveyBatches.length, false);
    }, [fetchSurveysPage, hasMoreSurveys, isSurveysLoading, isSurveysLoadingMore, surveyBatches.length]);

    const fetchDetailsPage = useCallback(async (surveyBatchOid: string, skip: number, replace: boolean) => {
        if (replace) {
            setIsDetailsLoading(true);
        } else {
            setIsDetailsLoadingMore(true);
        }
        setDetailsError(null);

        try {
            const params = new URLSearchParams();
            params.set('limit', String(DETAILS_PAGE_SIZE));
            params.set('skip', String(skip));
            if (detailsStatusFilter) params.set('status', detailsStatusFilter);

            const response = await fetch(
                `/api/campaigns/survey_batchs/${encodeURIComponent(surveyBatchOid)}/surveys?${params.toString()}`,
                { cache: 'no-store' }
            );

            if (!response.ok) {
                throw new Error(t('errors.loadDetails'));
            }

            const payload = (await response.json()) as SurveyChildListResponse;
            const pageItems = Array.isArray(payload.items) ? payload.items : [];

            setDetails((current) => {
                const base = replace ? [] : current;
                const seen = new Set(base.map((item) => item.oid));
                const additions = pageItems.filter((item) => {
                    if (seen.has(item.oid)) return false;
                    seen.add(item.oid);
                    return true;
                });
                const next = [...base, ...additions];
                const nextTotal = payload.total ?? next.length;
                const nextHasMore = typeof payload.total === 'number'
                    ? next.length < payload.total
                    : pageItems.length >= DETAILS_PAGE_SIZE;

                setDetailsTotal(nextTotal);
                setHasMoreDetails(nextHasMore);

                return next;
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : t('errors.loadDetails');
            setDetailsError(message);
            if (replace) {
                setDetails([]);
                setDetailsTotal(0);
                setHasMoreDetails(true);
            }
        } finally {
            if (replace) {
                setIsDetailsLoading(false);
            } else {
                setIsDetailsLoadingMore(false);
            }
        }
    }, [detailsStatusFilter, t]);

    const loadMoreDetails = useCallback(async () => {
        if (isDetailsLoading || isDetailsLoadingMore || !hasMoreDetails || !selectedSurveyBatchOid) return;
        await fetchDetailsPage(selectedSurveyBatchOid, details.length, false);
    }, [details.length, fetchDetailsPage, hasMoreDetails, isDetailsLoading, isDetailsLoadingMore, selectedSurveyBatchOid]);

    useEffect(() => {
        void reloadSurveys();
    }, [reloadSurveys]);

    useEffect(() => {
        if (surveyBatches.length === 0) return;
        if (!selectedSurveyBatchOid || !surveyBatches.some((item) => item.oid === selectedSurveyBatchOid)) {
            setQueryParam('surveyBatch', surveyBatches[0]?.oid ?? null);
        }
    }, [surveyBatches, selectedSurveyBatchOid, setQueryParam]);

    useEffect(() => {
        if (!selectedSurveyBatchOid) {
            setDetails([]);
            setDetailsTotal(0);
            setHasMoreDetails(true);
            setSelectedSurveyOid(null);
            return;
        }
        setHasMoreDetails(true);
        void fetchDetailsPage(selectedSurveyBatchOid, 0, true);
    }, [fetchDetailsPage, selectedSurveyBatchOid]);

    useEffect(() => {
        const container = surveysListRef.current;
        if (!container) return;
        if (isSurveysLoading || isSurveysLoadingMore || !hasMoreSurveys) return;
        if (container.scrollHeight <= container.clientHeight + 1) {
            void loadMoreSurveys();
        }
    }, [hasMoreSurveys, isSurveysLoading, isSurveysLoadingMore, loadMoreSurveys, surveyBatches.length]);

    useEffect(() => {
        const container = surveyDetailsListRef.current;
        if (!container) return;
        if (isDetailsLoading || isDetailsLoadingMore || !hasMoreDetails) return;
        if (container.scrollHeight <= container.clientHeight + 1) {
            void loadMoreDetails();
        }
    }, [details.length, hasMoreDetails, isDetailsLoading, isDetailsLoadingMore, loadMoreDetails]);

    const selectedSurveyBatch = useMemo(
        () => surveyBatches.find((survey) => survey.oid === selectedSurveyBatchOid) ?? null,
        [surveyBatches, selectedSurveyBatchOid]
    );

    useEffect(() => {
        if (!selectedSurveyBatch) return;
        setObjectName(selectedSurveyBatch.name);
        setObjectError(null);
        setIsObjectEditing(false);
    }, [selectedSurveyBatch]);

    useEffect(() => {
        setIsRowEditorOpen(false);
        setRowError(null);
    }, [selectedSurveyBatchOid]);

    const filteredSurveys = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return surveyBatches;
        return surveyBatches.filter((item) => (
            item.name.toLowerCase().includes(query)
            || item.oid.toLowerCase().includes(query)
        ));
    }, [surveyBatches, searchQuery]);

    const filteredDetails = useMemo(() => {
        const query = detailsSearch.trim().toLowerCase();
        if (!query) return details;
        return details.filter((item) => (
            item.receiver_stable_id.toLowerCase().includes(query)
            || summarizeSurveyAnswer(item.survey_answer).toLowerCase().includes(query)
        ));
    }, [details, detailsSearch]);

    useEffect(() => {
        if (filteredDetails.length === 0) {
            setSelectedSurveyOid(null);
            return;
        }
        if (!selectedSurveyOid || !filteredDetails.some((item) => item.oid === selectedSurveyOid)) {
            setSelectedSurveyOid(filteredDetails[0].oid);
        }
    }, [filteredDetails, selectedSurveyOid]);

    const handleSurveysListScroll = useCallback(() => {
        const container = surveysListRef.current;
        if (!container || isSurveysLoading || isSurveysLoadingMore || !hasMoreSurveys) return;
        const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (remaining <= LIST_SCROLL_LOAD_THRESHOLD) {
            void loadMoreSurveys();
        }
    }, [hasMoreSurveys, isSurveysLoading, isSurveysLoadingMore, loadMoreSurveys]);

    const handleSurveyDetailsListScroll = useCallback(() => {
        const container = surveyDetailsListRef.current;
        if (!container || isDetailsLoading || isDetailsLoadingMore || !hasMoreDetails) return;
        const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (remaining <= DETAILS_SCROLL_LOAD_THRESHOLD) {
            void loadMoreDetails();
        }
    }, [hasMoreDetails, isDetailsLoading, isDetailsLoadingMore, loadMoreDetails]);

    const handleSaveObject = () => {
        if (!selectedSurveyBatch) return;

        const nextName = objectName.trim();
        if (nextName.length === 0) {
            setObjectError(t('edit.errors.emptyName'));
            return;
        }

        setObjectError(null);
        startObjectSavingTransition(async () => {
            const result = await updateCampaignSurveyBatchAction(selectedSurveyBatch.oid, {
                name: nextName,
            });

            if (!result.success) {
                setObjectError(result.error);
                return;
            }

            setIsObjectEditing(false);
            await reloadSurveys();
            await fetchDetailsPage(selectedSurveyBatch.oid, 0, true);
        });
    };

    const openCreateRowEditor = () => {
        const reference = details[0]?.survey_questions ?? fallbackSurveyQuestions();
        setRowEditorMode('create');
        setEditingSurveyOid(null);
        setRowReceiverStableId('');
        setRowIntro(reference.intro);
        setRowQuestions(toQuestionDrafts(reference));
        setRowStatus('created');
        setRowSubmittedAt('');
        setRowAnswerText('');
        setRowCreatedAt(null);
        setRowUpdatedAt(null);
        setRowError(null);
        setIsRowEditorOpen(true);
    };

    const openEditRowEditor = (detail: Survey) => {
        setSelectedSurveyOid(detail.oid);
        setRowEditorMode('edit');
        setEditingSurveyOid(detail.oid);
        setRowReceiverStableId(detail.receiver_stable_id);
        setRowIntro(detail.survey_questions.intro);
        setRowQuestions(toQuestionDrafts(detail.survey_questions));
        setRowStatus(detail.status);
        setRowSubmittedAt(toDateTimeInputValue(detail.submitted_at));
        setRowAnswerText(stringifySurveyAnswer(detail.survey_answer));
        setRowCreatedAt(detail.created_at);
        setRowUpdatedAt(detail.updated_at);
        setRowError(null);
        setIsRowEditorOpen(true);
    };

    const closeRowEditor = () => {
        if (isRowSaving || isRowDeleting) return;
        setIsRowEditorOpen(false);
        setRowError(null);
    };

    const handleSaveRow = () => {
        if (!selectedSurveyBatch) return;

        const receiverStableId = rowReceiverStableId.trim();
        if (receiverStableId.length === 0) {
            setRowError(t('details.rowEditor.errors.emptyReceiver'));
            return;
        }

        if (rowEditorMode === 'create' && details.some((item) => item.receiver_stable_id === receiverStableId)) {
            setRowError(t('edit.errors.duplicateReceiver'));
            return;
        }

        const surveyQuestions = toSurveyQuestions(rowIntro, rowQuestions);
        const questionError = validateSurveyQuestions(surveyQuestions);
        if (questionError) {
            setRowError(questionError);
            return;
        }

        const submittedAt = fromDateTimeInputValue(rowSubmittedAt);
        let surveyAnswerPayload: SurveyAnswerPayload | null = null;

        if (rowAnswerText.trim().length > 0) {
            try {
                surveyAnswerPayload = parseSurveyAnswerJson(rowAnswerText);
            } catch (error) {
                setRowError(error instanceof Error ? error.message : t('edit.errors.invalidAnswerJson'));
                return;
            }
        }

        if (rowStatus === 'submitted') {
            if (!submittedAt) {
                setRowError(t('details.rowEditor.errors.submittedAtRequired'));
                return;
            }

            if (!surveyAnswerPayload) {
                setRowError(t('details.rowEditor.errors.answerRequired'));
                return;
            }

            const answerError = validateSurveyAnswerPayload(surveyQuestions, surveyAnswerPayload);
            if (answerError) {
                setRowError(answerError);
                return;
            }
        } else {
            if (submittedAt) {
                setRowError(t('details.rowEditor.errors.createdSubmittedAtNotAllowed'));
                return;
            }

            if (surveyAnswerPayload) {
                setRowError(t('details.rowEditor.errors.createdAnswerNotAllowed'));
                return;
            }
        }

        const payload = {
            survey_questions: surveyQuestions,
            status: rowStatus,
            submitted_at: rowStatus === 'submitted' ? submittedAt : null,
            survey_answer: rowStatus === 'submitted' ? surveyAnswerPayload : null,
        };

        setRowError(null);

        if (rowEditorMode === 'edit' && !editingSurveyOid) {
            setRowError(t('errors.loadDetails'));
            return;
        }

        startRowSavingTransition(async () => {
            const result = rowEditorMode === 'create'
                ? await createCampaignSurveyAction(selectedSurveyBatch.oid, {
                    receiver_stable_id: receiverStableId,
                    ...payload,
                })
                : await updateCampaignSurveyAction(
                    selectedSurveyBatch.oid,
                    editingSurveyOid as string,
                    payload
                );

            if (!result.success) {
                setRowError(result.error);
                return;
            }

            setIsRowEditorOpen(false);
            await fetchDetailsPage(selectedSurveyBatch.oid, 0, true);
            await reloadSurveys();
        });
    };

    const handleDeleteRow = () => {
        if (!selectedSurveyBatch || rowEditorMode !== 'edit' || !editingSurveyOid) return;

        setRowError(null);
        startRowDeletingTransition(async () => {
            const result = await deleteCampaignSurveyAction(
                selectedSurveyBatch.oid,
                editingSurveyOid
            );

            if (!result.success) {
                setRowError(result.error);
                return;
            }

            setIsRowEditorOpen(false);
            await fetchDetailsPage(selectedSurveyBatch.oid, 0, true);
            await reloadSurveys();
        });
    };

    return (
        <SurveyAccessGate>
            <div className="h-[calc(100vh-4rem)] p-4 overflow-hidden">
                <div className="h-full min-h-0 grid grid-cols-[360px_1fr] gap-4">
                    <section className={`h-full min-h-0 rounded-xl border flex flex-col ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <header className="p-4 border-b border-white/10 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <ClipboardCheck className="w-4 h-4 text-blue-300" />
                                    <h1 className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('list.title')}</h1>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void reloadSurveys()}
                                    className={`p-1.5 rounded-md ${isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/10 text-gray-300'}`}
                                >
                                    <RefreshCw className={`w-4 h-4 ${(isSurveysLoading || isSurveysLoadingMore) ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value as SurveyBatchStatus | '')}
                                className={`w-full px-2 py-1.5 text-sm rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                            >
                                <option value="">{t('list.filters.allStatus')}</option>
                                <option value="created">created</option>
                                <option value="partial">partial</option>
                                <option value="completed">completed</option>
                                <option value="cancelled">cancelled</option>
                            </select>

                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder={t('list.filters.search')}
                                className={`w-full px-2 py-1.5 text-sm rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                            />

                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                {t('list.counts', {
                                    loaded: filteredSurveys.length,
                                    total: surveysTotal,
                                })}
                            </p>

                            {canWrite && (
                                <button
                                    type="button"
                                    onClick={() => router.push('/campaign/survey-batches/new')}
                                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>{t('list.create')}</span>
                                </button>
                            )}
                        </header>

                        <div className="flex flex-1 min-h-0">
                            <div
                                ref={surveysListRef}
                                onScroll={handleSurveysListScroll}
                                className="flex-1 min-w-0 h-full overflow-y-auto campaign-pane-scroll-no-native"
                            >
                                {isSurveysLoading && filteredSurveys.length === 0 ? (
                                    <div className="p-4 text-sm text-gray-300 inline-flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('list.loading')}
                                    </div>
                                ) : surveysError ? (
                                    <div className="p-4 text-sm text-rose-300">{surveysError}</div>
                                ) : filteredSurveys.length === 0 ? (
                                    <div className="p-4 text-sm text-gray-400">{t('list.empty')}</div>
                                ) : (
                                    filteredSurveys.map((item) => {
                                        const selected = item.oid === selectedSurveyBatchOid;
                                        return (
                                            <button
                                                key={item.oid}
                                                type="button"
                                                onClick={() => setQueryParam('surveyBatch', item.oid)}
                                                className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 ${selected ? 'bg-blue-500/10' : ''}`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={`text-sm font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{item.name}</p>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs border ${getSurveyStatusClass(item.status)}`}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                    {t('details.fields.total')}: {item.total_count}
                                                </p>
                                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                    {t('details.fields.creator')}: {item.creator_account || '—'}
                                                </p>
                                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                    {t('details.fields.updatedAt')}: {formatDateTime(item.updated_at)}
                                                </p>
                                            </button>
                                        );
                                    })
                                )}

                                {isSurveysLoadingMore && (
                                    <div className={`p-3 text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'} inline-flex items-center gap-2`}>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        {t('list.loading')}
                                    </div>
                                )}
                            </div>

                            <PaneQuickScrollButtons containerRef={surveysListRef} isLight={isLight} />
                        </div>
                    </section>

                    <section className={`h-full min-h-0 rounded-xl border flex flex-col ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        {!selectedSurveyBatch ? (
                            <div className="h-full flex items-center justify-center text-sm text-gray-400">
                                {t('details.selectSurvey')}
                            </div>
                        ) : (
                            <>
                                <header className="p-4 border-b border-white/10 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{selectedSurveyBatch.name}</h2>
                                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                {selectedSurveyBatch.oid}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {canWrite && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsObjectEditing((current) => !current);
                                                        setObjectError(null);
                                                        setObjectName(selectedSurveyBatch.name);
                                                    }}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                    <span>{t('details.actions.editObject')}</span>
                                                </button>
                                            )}

                                            {canWrite && (
                                                <button
                                                    type="button"
                                                    onClick={openCreateRowEditor}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20"
                                                >
                                                    <Plus className="w-4 h-4" />
                                                    <span>{t('details.actions.addRow')}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {isObjectEditing ? (
                                        <div className="space-y-3 rounded-lg border border-white/10 p-3">
                                            <div>
                                                <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('edit.fields.name')}</label>
                                                <input
                                                    type="text"
                                                    value={objectName}
                                                    onChange={(event) => setObjectName(event.target.value)}
                                                    disabled={isObjectSaving}
                                                    className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                                />
                                            </div>

                                            {objectError && (
                                                <p className="text-xs text-rose-300">{objectError}</p>
                                            )}

                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsObjectEditing(false);
                                                        setObjectError(null);
                                                        setObjectName(selectedSurveyBatch.name);
                                                    }}
                                                    disabled={isObjectSaving}
                                                    className={`px-3 py-1.5 rounded-md text-sm border ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-gray-200 hover:bg-white/10'} disabled:opacity-60`}
                                                >
                                                    {t('details.actions.cancel')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveObject}
                                                    disabled={isObjectSaving}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
                                                >
                                                    {isObjectSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                                    <span>{t('edit.actions.save')}</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                <div>
                                                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.status')}</p>
                                                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs border ${getSurveyBatchStatusClass(selectedSurveyBatch.status)}`}>
                                                        {selectedSurveyBatch.status}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.total')}</p>
                                                    <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{selectedSurveyBatch.total_count}</p>
                                                </div>
                                                <div>
                                                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.createdAt')}</p>
                                                    <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(selectedSurveyBatch.created_at)}</p>
                                                </div>
                                                <div>
                                                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.updatedAt')}</p>
                                                    <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(selectedSurveyBatch.updated_at)}</p>
                                                </div>
                                            </div>

                                            <div className="text-xs">
                                                <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.creator')}</p>
                                                <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{selectedSurveyBatch.creator_account || '—'}</p>
                                            </div>
                                        </>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={detailsStatusFilter}
                                            onChange={(event) => setDetailsStatusFilter(event.target.value as SurveyStatus | '')}
                                            className={`px-2 py-1.5 text-sm rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                        >
                                            <option value="">{t('details.filters.allStatus')}</option>
                                            <option value="created">created</option>
                                            <option value="submitted">submitted</option>
                                        </select>

                                        <input
                                            type="text"
                                            value={detailsSearch}
                                            onChange={(event) => setDetailsSearch(event.target.value)}
                                            placeholder={t('details.filters.search')}
                                            className={`px-2 py-1.5 text-sm rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                        />
                                    </div>

                                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                        {t('details.counts', {
                                            loaded: filteredDetails.length,
                                            total: detailsTotal,
                                        })}
                                    </p>
                                </header>

                                {isRowEditorOpen && (
                                    <section className={`mx-4 mt-4 mb-3 rounded-lg border p-4 space-y-3 max-h-[60vh] overflow-y-auto campaign-pane-scroll-no-native ${isLight ? 'border-slate-200 bg-slate-50/80' : 'border-white/10 bg-slate-900/40'}`}>
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <h3 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                {rowEditorMode === 'create'
                                                    ? t('details.rowEditor.createTitle')
                                                    : t('details.rowEditor.editTitle', { receiver: rowReceiverStableId })}
                                            </h3>

                                            <div className="flex items-center gap-2">
                                                {rowEditorMode === 'edit' && (
                                                    <button
                                                        type="button"
                                                        onClick={handleDeleteRow}
                                                        disabled={!canWrite || isRowSaving || isRowDeleting}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-rose-400/40 text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                                                    >
                                                        {isRowDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                        <span>{t('details.rowEditor.actions.delete')}</span>
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={closeRowEditor}
                                                    disabled={isRowSaving || isRowDeleting}
                                                    className={`px-3 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/10 text-gray-200 hover:bg-white/10'} disabled:opacity-60`}
                                                >
                                                    {t('details.actions.cancel')}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveRow}
                                                    disabled={!canWrite || isRowSaving || isRowDeleting}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
                                                >
                                                    {isRowSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                                    <span>{rowEditorMode === 'create' ? t('details.rowEditor.actions.create') : t('details.rowEditor.actions.save')}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {rowError && (
                                            <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                                                {rowError}
                                            </div>
                                        )}

                                        <div>
                                            <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('details.rowEditor.fields.receiver')}</label>
                                            <input
                                                type="text"
                                                value={rowReceiverStableId}
                                                onChange={(event) => setRowReceiverStableId(event.target.value)}
                                                disabled={rowEditorMode === 'edit' || isRowSaving || isRowDeleting || !canWrite}
                                                className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('details.rowEditor.fields.status')}</label>
                                                <select
                                                    value={rowStatus}
                                                    onChange={(event) => setRowStatus(event.target.value as SurveyStatus)}
                                                    disabled={isRowSaving || isRowDeleting || !canWrite}
                                                    className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                                >
                                                    <option value="created">created</option>
                                                    <option value="submitted">submitted</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('details.rowEditor.fields.submittedAt')}</label>
                                                <input
                                                    type="datetime-local"
                                                    value={rowSubmittedAt}
                                                    onChange={(event) => setRowSubmittedAt(event.target.value)}
                                                    disabled={isRowSaving || isRowDeleting || !canWrite}
                                                    className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                                />
                                            </div>
                                        </div>

                                        {(rowCreatedAt || rowUpdatedAt) && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.createdAt')}</p>
                                                    <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(rowCreatedAt)}</p>
                                                </div>
                                                <div>
                                                    <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.updatedAt')}</p>
                                                    <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(rowUpdatedAt)}</p>
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('details.rowEditor.fields.answerJson')}</label>
                                            <textarea
                                                value={rowAnswerText}
                                                onChange={(event) => setRowAnswerText(event.target.value)}
                                                disabled={isRowSaving || isRowDeleting || !canWrite}
                                                rows={8}
                                                placeholder={t('details.rowEditor.fields.answerJsonPlaceholder')}
                                                className={`w-full px-2 py-1.5 rounded-md border text-sm font-mono resize-y ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                            />
                                        </div>

                                        <div>
                                            <p className={`text-xs mb-2 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('details.rowEditor.fields.questions')}</p>
                                            <SurveyQuestionBuilder
                                                intro={rowIntro}
                                                onIntroChange={setRowIntro}
                                                questions={rowQuestions}
                                                onQuestionsChange={setRowQuestions}
                                                disabled={isRowSaving || isRowDeleting || !canWrite}
                                            />
                                        </div>
                                    </section>
                                )}

                                <div className="flex flex-1 min-h-0">
                                    <div
                                        ref={surveyDetailsListRef}
                                        onScroll={handleSurveyDetailsListScroll}
                                        className="flex-1 min-w-0 h-full overflow-y-auto campaign-pane-scroll-no-native"
                                    >
                                        {isDetailsLoading && filteredDetails.length === 0 ? (
                                            <div className="p-4 text-sm text-gray-300 inline-flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                {t('details.loading')}
                                            </div>
                                        ) : detailsError ? (
                                            <div className="p-4 text-sm text-rose-300">{detailsError}</div>
                                        ) : filteredDetails.length === 0 ? (
                                            <div className="p-4 text-sm text-gray-400">{t('details.empty')}</div>
                                        ) : (
                                            <div className="divide-y divide-white/5">
                                                {filteredDetails.map((detail) => {
                                                    const isSelected = detail.oid === selectedSurveyOid;
                                                    return (
                                                        <button
                                                            key={detail.oid}
                                                            type="button"
                                                            onClick={() => openEditRowEditor(detail)}
                                                            className={`w-full text-left px-4 py-3 hover:bg-white/5 ${isSelected ? 'bg-blue-500/10' : ''}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className={`text-sm font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>{detail.receiver_stable_id}</p>
                                                                <span className={`px-2 py-0.5 rounded-full text-xs border ${getSurveyStatusClass(detail.status)}`}>
                                                                    {detail.status}
                                                                </span>
                                                            </div>
                                                            <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                                {t('details.fields.submittedAt')}: {formatDateTime(detail.submitted_at)}
                                                            </p>
                                                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                                {t('details.fields.questions')}: {detail.survey_questions.questions.length}
                                                            </p>
                                                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                                {t('details.fields.answer')}: {summarizeSurveyAnswer(detail.survey_answer)}
                                                            </p>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {isDetailsLoadingMore && (
                                            <div className={`p-3 text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'} inline-flex items-center gap-2`}>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                {t('details.loading')}
                                            </div>
                                        )}
                                    </div>

                                    <PaneQuickScrollButtons containerRef={surveyDetailsListRef} isLight={isLight} />
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </div>
        </SurveyAccessGate>
    );
}
