'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import Image from 'next/image';
import { ClipboardCheck, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import { formatSurveyIntro } from '@/lib/utils/survey-datetime';
import { usePermissions } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';
import type {
    Survey,
    SurveyAnswer,
    SurveyAnswerPayload,
    SurveyBatch,
    SurveyBatchListResponse,
    SurveyBatchStatus,
    SurveyQuestions,
    SurveyStatus,
} from '@/lib/types/objects';
import {
    cancelCampaignSurveyBatchAction,
    closeCampaignSurveyBatchAction,
    createCampaignSurveyAction,
    deleteCampaignSurveyBatchAction,
    publishCampaignSurveyBatchAction,
    reopenCampaignSurveyBatchAction,
    revokeCampaignSurveyAction,
    submitCampaignSurveyAction,
    updateCampaignSurveyBatchAction,
    updateCampaignSurveyAction,
    deleteCampaignSurveyAction,
} from '@/app/actions/campaigns';
import { DeleteBatchModal, PaneQuickScrollButtons } from '@/components/campaign_shared';
import { SurveyAccessGate } from './SurveyAccessGate';
import { SurveyQuestionBuilder } from './SurveyQuestionBuilder';
import type { SurveyQuestionDraft } from './types';
import {
    createEmptyQuestionDraft,
    draftFromQuestion,
    getSurveyBatchStatusClass,
    getSurveyStatusClass,
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
const DETAILS_PAGE_SIZE = 500;

function inferMimeTypeFromDataUrl(value: string | null): string | null {
    if (!value) return null;
    const matched = value.match(/^data:([^;,]+);base64,/i);
    return matched?.[1] ?? null;
}

function toPureBase64(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (!trimmed.startsWith('data:')) return trimmed;

    const commaIndex = trimmed.indexOf(',');
    if (commaIndex < 0) return null;
    const payload = trimmed.slice(commaIndex + 1).trim();
    return payload || null;
}

function toImageSrc(imageBase64: string | null | undefined, imageType: string | null | undefined): string | null {
    if (!imageBase64) return null;
    if (imageBase64.startsWith('data:')) return imageBase64;
    const normalizedType = imageType && imageType.startsWith('image/') ? imageType : 'image/png';
    return `data:${normalizedType};base64,${imageBase64}`;
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

function getSurveyAnswerForQuestion(
    answerPayload: SurveyAnswerPayload | null,
    questionId: string
): SurveyAnswer | null {
    if (!answerPayload || !Array.isArray(answerPayload.answers)) return null;
    return answerPayload.answers.find((answer) => answer.question_id === questionId) ?? null;
}

function formatSurveyAnswerValue(
    question: SurveyQuestions['questions'][number],
    answer: SurveyAnswer | null
): string {
    if (!answer || answer.type !== question.type) return '—';

    if (answer.type === 'text') {
        return answer.text.trim().length > 0 ? answer.text : '—';
    }

    if (answer.type === 'single_select') {
        if (!('options' in question)) return answer.selected_option_id || '—';
        const matchedOption = question.options.find((option) => option.option_id === answer.selected_option_id);
        return matchedOption ? matchedOption.label : (answer.selected_option_id || '—');
    }

    if (!('options' in question) || answer.selected_option_ids.length === 0) return '—';
    const labels = answer.selected_option_ids.map((optionId) => {
        const matchedOption = question.options.find((option) => option.option_id === optionId);
        return matchedOption ? matchedOption.label : optionId;
    });

    return labels.length > 0 ? labels.join(', ') : '—';
}

function normalizeSurveyAnswerPayload(
    surveyQuestions: SurveyQuestions,
    answerPayload: SurveyAnswerPayload | null
): SurveyAnswerPayload | null {
    if (!answerPayload || !Array.isArray(answerPayload.answers) || answerPayload.answers.length === 0) {
        return null;
    }

    const questionById = new Map(surveyQuestions.questions.map((question) => [question.question_id, question]));
    const answersByQuestionId = new Map<string, SurveyAnswer>();

    for (const answer of answerPayload.answers) {
        const question = questionById.get(answer.question_id);
        if (!question || answer.type !== question.type) continue;

        if (answer.type === 'text') {
            const nextText = answer.text.trim();
            if (nextText.length === 0) continue;
            answersByQuestionId.set(answer.question_id, {
                ...answer,
                text: nextText,
            });
            continue;
        }

        if (answer.type === 'single_select') {
            const nextOptionId = answer.selected_option_id.trim();
            if (nextOptionId.length === 0) continue;
            if (!('options' in question)) continue;
            const validOptionIds = new Set(question.options.map((option) => option.option_id));
            if (!validOptionIds.has(nextOptionId)) continue;
            answersByQuestionId.set(answer.question_id, {
                ...answer,
                selected_option_id: nextOptionId,
            });
            continue;
        }

        if (!('options' in question)) continue;
        const validOptionIds = new Set(question.options.map((option) => option.option_id));
        const nextOptionIds = answer.selected_option_ids
            .map((optionId) => optionId.trim())
            .filter((optionId) => optionId.length > 0 && validOptionIds.has(optionId));
        if (nextOptionIds.length === 0) continue;

        answersByQuestionId.set(answer.question_id, {
            ...answer,
            selected_option_ids: Array.from(new Set(nextOptionIds)),
        });
    }

    const answers = Array.from(answersByQuestionId.values());
    return answers.length > 0 ? { answers } : null;
}

export function SurveysModule() {
    const t = useTranslations('CampaignSurvey');
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const isLight = theme === 'light';
    const router = useTransitionRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { hasPermission } = usePermissions();
    const canWrite = hasPermission(PERMISSIONS.OBJECTS.SURVEY_BATCHS_WRITE);

    const [isBatchActionPending, startBatchActionTransition] = useTransition();
    const [isObjectSaving, startObjectSavingTransition] = useTransition();
    const [isRowSaving, startRowSavingTransition] = useTransition();
    const [isRowDeleting, startRowDeletingTransition] = useTransition();

    const [statusFilter, setStatusFilter] = useState<SurveyBatchStatus | ''>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [detailsStatusFilter, setDetailsStatusFilter] = useState<SurveyStatus | ''>('');
    const [detailsSearch, setDetailsSearch] = useState('');

    const [surveyBatches, setSurveyBatches] = useState<SurveyBatch[]>([]);
    const [selectedSurveyBatchDetail, setSelectedSurveyBatchDetail] = useState<SurveyBatch | null>(null);
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

    const [isDeleteBatchModalOpen, setIsDeleteBatchModalOpen] = useState(false);
    const [deleteBatchError, setDeleteBatchError] = useState<string | null>(null);

    const [isObjectEditing, setIsObjectEditing] = useState(false);
    const [objectName, setObjectName] = useState('');
    const [objectImageType, setObjectImageType] = useState<string | null>(null);
    const [objectImageId, setObjectImageId] = useState<string | null>(null);
    const [objectImageBase64, setObjectImageBase64] = useState<string | null>(null);
    const [objectImageFilename, setObjectImageFilename] = useState<string | null>(null);
    const [objectError, setObjectError] = useState<string | null>(null);

    const [isRowEditorOpen, setIsRowEditorOpen] = useState(false);
    const [rowEditorMode, setRowEditorMode] = useState<'create' | 'edit'>('edit');
    const [editingSurveyOid, setEditingSurveyOid] = useState<string | null>(null);
    const [rowReceiverStableId, setRowReceiverStableId] = useState('');
    const [rowIntro, setRowIntro] = useState('');
    const [rowQuestions, setRowQuestions] = useState<SurveyQuestionDraft[]>([createEmptyQuestionDraft('text')]);
    const [rowStatus, setRowStatus] = useState<SurveyStatus>('not_started');
    const [rowSurveyAnswer, setRowSurveyAnswer] = useState<SurveyAnswerPayload | null>(null);
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

    const fetchSurveyBatchDetail = useCallback(async (surveyBatchOid: string) => {
        try {
            const response = await fetch(`/api/campaigns/survey_batchs/${encodeURIComponent(surveyBatchOid)}`, {
                cache: 'no-store',
            });
            if (!response.ok) {
                throw new Error(t('errors.loadSurveys'));
            }

            const payload = (await response.json()) as SurveyBatch;
            setSelectedSurveyBatchDetail(payload);
        } catch (error) {
            const message = error instanceof Error ? error.message : t('errors.loadSurveys');
            setDetailsError(message);
            setSelectedSurveyBatchDetail(null);
        }
    }, [t]);

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
                const noProgress = !replace && additions.length === 0;
                const nextHasMore = noProgress
                    ? false
                    : typeof payload.total === 'number'
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
                const noProgress = !replace && additions.length === 0;
                const nextHasMore = noProgress
                    ? false
                    : typeof payload.total === 'number'
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
            setSelectedSurveyBatchDetail(null);
            setDetails([]);
            setDetailsTotal(0);
            setHasMoreDetails(true);
            setSelectedSurveyOid(null);
            return;
        }
        void fetchSurveyBatchDetail(selectedSurveyBatchOid);
        setHasMoreDetails(true);
        void fetchDetailsPage(selectedSurveyBatchOid, 0, true);
    }, [fetchDetailsPage, fetchSurveyBatchDetail, selectedSurveyBatchOid]);

    const selectedSurveyBatchListItem = useMemo(
        () => surveyBatches.find((survey) => survey.oid === selectedSurveyBatchOid) ?? null,
        [surveyBatches, selectedSurveyBatchOid]
    );
    const selectedSurveyBatch = useMemo(() => {
        if (selectedSurveyBatchDetail && selectedSurveyBatchDetail.oid === selectedSurveyBatchOid) {
            return selectedSurveyBatchDetail;
        }
        return selectedSurveyBatchListItem;
    }, [selectedSurveyBatchDetail, selectedSurveyBatchListItem, selectedSurveyBatchOid]);
    const isBatchDraft = selectedSurveyBatch?.status === 'draft';
    const shouldAutoRefreshBatch = selectedSurveyBatch?.status === 'collecting';

    useEffect(() => {
        if (!selectedSurveyBatch) return;
        setObjectName(selectedSurveyBatch.name);
        setObjectImageType(selectedSurveyBatch.image_type ?? null);
        setObjectImageId(selectedSurveyBatch.image_id ?? null);
        setObjectImageBase64(selectedSurveyBatch.image_base64 ?? null);
        setObjectImageFilename(null);
        setObjectError(null);
        setIsObjectEditing(false);
    }, [selectedSurveyBatch]);

    useEffect(() => {
        setIsRowEditorOpen(false);
        setRowError(null);
    }, [selectedSurveyBatchOid]);

    useEffect(() => {
        if (!selectedSurveyBatchOid || !shouldAutoRefreshBatch) return;

        const intervalId = window.setInterval(() => {
            if (document.visibilityState !== 'visible') return;

            void (async () => {
                await reloadSurveys();
                await fetchSurveyBatchDetail(selectedSurveyBatchOid);
            })();
        }, 8_000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [fetchSurveyBatchDetail, reloadSurveys, selectedSurveyBatchOid, shouldAutoRefreshBatch]);

    const normalizedSearchQuery = searchQuery.trim();

    const filteredSurveys = useMemo(() => {
        const query = normalizedSearchQuery.toLowerCase();
        if (!query) return surveyBatches;
        return surveyBatches.filter((item) => (
            item.name.toLowerCase().includes(query)
            || item.oid.toLowerCase().includes(query)
        ));
    }, [surveyBatches, normalizedSearchQuery]);

    const filteredDetails = useMemo(() => {
        const query = detailsSearch.trim().toLowerCase();
        if (!query) return details;
        return details.filter((item) => (
            item.receiver_stable_id.toLowerCase().includes(query)
            || summarizeSurveyAnswer(item.survey_answer).toLowerCase().includes(query)
        ));
    }, [details, detailsSearch]);

    const selectedSurveyImageSrc = useMemo(
        () => toImageSrc(selectedSurveyBatch?.image_base64, selectedSurveyBatch?.image_type),
        [selectedSurveyBatch?.image_base64, selectedSurveyBatch?.image_type]
    );

    useEffect(() => {
        if (filteredDetails.length === 0) {
            setSelectedSurveyOid(null);
            return;
        }
        if (!selectedSurveyOid || !filteredDetails.some((item) => item.oid === selectedSurveyOid)) {
            setSelectedSurveyOid(filteredDetails[0].oid);
        }
    }, [filteredDetails, selectedSurveyOid]);

    useEffect(() => {
        if (surveysError) return;
        if (isSurveysLoading || isSurveysLoadingMore || !hasMoreSurveys) return;
        if (surveyBatches.length === 0) return;
        void loadMoreSurveys();
    }, [
        hasMoreSurveys,
        isSurveysLoading,
        isSurveysLoadingMore,
        loadMoreSurveys,
        surveyBatches.length,
        surveysError,
    ]);

    useEffect(() => {
        if (!selectedSurveyBatchOid) return;
        if (detailsError) return;
        if (isDetailsLoading || isDetailsLoadingMore || !hasMoreDetails) return;
        if (details.length === 0) return;
        void loadMoreDetails();
    }, [
        details.length,
        detailsError,
        hasMoreDetails,
        isDetailsLoading,
        isDetailsLoadingMore,
        loadMoreDetails,
        selectedSurveyBatchOid,
    ]);

    const clearObjectImage = useCallback(() => {
        setObjectImageType(null);
        setObjectImageId(null);
        setObjectImageBase64(null);
        setObjectImageFilename(null);
    }, []);

    const handleObjectImageUpload = useCallback(async (file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            setObjectError('Only image files are supported.');
            return;
        }

        try {
            const imageDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    if (typeof reader.result === 'string') {
                        resolve(reader.result);
                        return;
                    }
                    reject(new Error('Failed to read image file'));
                };
                reader.onerror = () => reject(new Error('Failed to read image file'));
                reader.readAsDataURL(file);
            });

            const imageBase64 = toPureBase64(imageDataUrl);
            if (!imageBase64) {
                throw new Error('Failed to parse image payload');
            }

            setObjectImageBase64(imageBase64);
            setObjectImageType(file.type || inferMimeTypeFromDataUrl(imageDataUrl));
            setObjectImageId(null);
            setObjectImageFilename(file.name);
            setObjectError(null);
        } catch (error) {
            setObjectError(error instanceof Error ? error.message : 'Failed to read image file');
        }
    }, []);

    const handleSaveObject = () => {
        if (!selectedSurveyBatch) return;
        if (!isBatchDraft) {
            setObjectError(t('details.serverManagedStatus'));
            return;
        }

        const nextName = objectName.trim();
        if (nextName.length === 0) {
            setObjectError(t('edit.errors.emptyName'));
            return;
        }

        const normalizedImageBase64 = toPureBase64(objectImageBase64);
        const normalizedImageType = objectImageType?.trim() || inferMimeTypeFromDataUrl(objectImageBase64) || null;
        const normalizedImageId = objectImageId?.trim() || null;

        setObjectError(null);
        startObjectSavingTransition(async () => {
            const result = await updateCampaignSurveyBatchAction(selectedSurveyBatch.oid, {
                name: nextName,
                image_type: normalizedImageType,
                image_id: normalizedImageId,
                image_base64: normalizedImageBase64,
            });

            if (!result.success) {
                setObjectError(result.error);
                return;
            }

            setIsObjectEditing(false);
            await reloadSurveys();
            await fetchSurveyBatchDetail(selectedSurveyBatch.oid);
            await fetchDetailsPage(selectedSurveyBatch.oid, 0, true);
        });
    };

    const handleBatchAction = (actionType: 'publish' | 'close' | 'reopen' | 'cancel') => {
        if (!selectedSurveyBatch) return;

        startBatchActionTransition(async () => {
            const result = actionType === 'publish'
                ? await publishCampaignSurveyBatchAction(selectedSurveyBatch.oid)
                : actionType === 'close'
                    ? await closeCampaignSurveyBatchAction(selectedSurveyBatch.oid)
                    : actionType === 'reopen'
                        ? await reopenCampaignSurveyBatchAction(selectedSurveyBatch.oid)
                        : await cancelCampaignSurveyBatchAction(selectedSurveyBatch.oid);

            if (!result.success) {
                setDetailsError(result.error);
                return;
            }

            await reloadSurveys();
            await fetchSurveyBatchDetail(selectedSurveyBatch.oid);
            await fetchDetailsPage(selectedSurveyBatch.oid, 0, true);
        });
    };

    const handleDeleteBatch = () => {
        if (!selectedSurveyBatch) return;
        setDeleteBatchError(null);
        startBatchActionTransition(async () => {
            const result = await deleteCampaignSurveyBatchAction(selectedSurveyBatch.oid);
            if (!result.success) {
                setDeleteBatchError(result.error);
                return;
            }

            setIsDeleteBatchModalOpen(false);
            setSelectedSurveyBatchDetail(null);
            setQueryParam('surveyBatch', null);
            await reloadSurveys();
        });
    };

    const openCreateRowEditor = () => {
        if (!isBatchDraft) return;
        const reference = details[0]?.survey_questions ?? fallbackSurveyQuestions();
        setRowEditorMode('create');
        setEditingSurveyOid(null);
        setRowReceiverStableId('');
        setRowIntro(reference.intro);
        setRowQuestions(toQuestionDrafts(reference));
        setRowStatus('not_started');
        setRowSurveyAnswer(null);
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
        setRowSurveyAnswer(detail.survey_answer);
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
        if (!isBatchDraft) {
            setRowError(t('details.serverManagedStatus'));
            return;
        }

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

        const payload = {
            survey_questions: surveyQuestions,
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

    const handleSubmitRowAction = () => {
        if (!selectedSurveyBatch || rowEditorMode !== 'edit' || !editingSurveyOid) return;
        if (selectedSurveyBatch.status === 'draft' || selectedSurveyBatch.status === 'cancelled') {
            setRowError(t('details.serverManagedStatus'));
            return;
        }
        if (rowStatus !== 'not_started' && rowStatus !== 'revoked') {
            setRowError(t('details.rowEditor.errors.submitNotAllowed'));
            return;
        }

        const surveyQuestions = toSurveyQuestions(rowIntro, rowQuestions);
        const questionError = validateSurveyQuestions(surveyQuestions);
        if (questionError) {
            setRowError(questionError);
            return;
        }

        const surveyAnswerPayload = normalizeSurveyAnswerPayload(surveyQuestions, rowSurveyAnswer);
        if (!surveyAnswerPayload) {
            setRowError(t('details.rowEditor.errors.answerRequired'));
            return;
        }

        const answerError = validateSurveyAnswerPayload(surveyQuestions, surveyAnswerPayload);
        if (answerError) {
            setRowError(answerError);
            return;
        }

        setRowError(null);
        startRowSavingTransition(async () => {
            const result = await submitCampaignSurveyAction(
                editingSurveyOid,
                surveyAnswerPayload
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

    const handleRevokeRowAction = () => {
        if (!selectedSurveyBatch || rowEditorMode !== 'edit' || !editingSurveyOid) return;
        if (selectedSurveyBatch.status === 'draft' || selectedSurveyBatch.status === 'cancelled') {
            setRowError(t('details.serverManagedStatus'));
            return;
        }
        if (rowStatus !== 'submitted') {
            setRowError(t('details.rowEditor.errors.revokeNotAllowed'));
            return;
        }

        setRowError(null);
        startRowSavingTransition(async () => {
            const result = await revokeCampaignSurveyAction(
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

    const handleDeleteRow = () => {
        if (!selectedSurveyBatch || rowEditorMode !== 'edit' || !editingSurveyOid) return;
        if (!isBatchDraft) {
            setRowError(t('details.serverManagedStatus'));
            return;
        }

        setRowError(null);
        startRowDeletingTransition(async () => {
            const result = await deleteCampaignSurveyAction(
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

    const isRowMetadataEditable = canWrite && isBatchDraft;
    const canSubmitRowAction = (
        rowEditorMode === 'edit'
        && (rowStatus === 'not_started' || rowStatus === 'revoked')
        && selectedSurveyBatch?.status !== 'draft'
        && selectedSurveyBatch?.status !== 'cancelled'
    );
    const canRevokeRowAction = (
        rowEditorMode === 'edit'
        && rowStatus === 'submitted'
        && selectedSurveyBatch?.status !== 'draft'
        && selectedSurveyBatch?.status !== 'cancelled'
    );
    const rowSurveyQuestions = useMemo(
        () => toSurveyQuestions(rowIntro, rowQuestions),
        [rowIntro, rowQuestions]
    );
    const isSubmittedSurveyRow = rowEditorMode === 'edit' && rowStatus === 'submitted';
    const showSurveyQuestionBuilder = !isSubmittedSurveyRow && (rowEditorMode === 'create' || isRowMetadataEditable);
    const showInlineQuestionAnswerView = rowEditorMode === 'edit' && !showSurveyQuestionBuilder;
    const isInlineAnswerEditable = (
        !isSubmittedSurveyRow
        && canWrite
        && canSubmitRowAction
        && !isRowSaving
        && !isRowDeleting
    );

    const upsertRowSurveyAnswer = useCallback((questionId: string, nextAnswer: SurveyAnswer | null) => {
        setRowSurveyAnswer((current) => {
            const baseAnswers = Array.isArray(current?.answers) ? current.answers : [];
            const filtered = baseAnswers.filter((answer) => answer.question_id !== questionId);
            if (!nextAnswer) {
                return filtered.length > 0 ? { answers: filtered } : null;
            }
            return {
                answers: [...filtered, nextAnswer],
            };
        });
    }, []);

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
                                <option value="draft">draft</option>
                                <option value="collecting">collecting</option>
                                <option value="closed">closed</option>
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
                                                    <span className={`px-2 py-0.5 rounded-full text-xs border ${getSurveyBatchStatusClass(item.status)}`}>
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
                                                    {t('details.fields.updatedAt')}: {formatDateTime(item.updated_at, timezone)}
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
                                            {canWrite && selectedSurveyBatch.status === 'draft' && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleBatchAction('publish')}
                                                        disabled={isBatchActionPending}
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
                                                    >
                                                        {isBatchActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                        <span>{t('details.actions.publishBatch')}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleBatchAction('cancel')}
                                                        disabled={isBatchActionPending}
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-rose-400/40 text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                                                    >
                                                        {isBatchActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                        <span>{t('details.actions.cancelBatch')}</span>
                                                    </button>
                                                </>
                                            )}

                                            {canWrite && selectedSurveyBatch.status === 'collecting' && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleBatchAction('close')}
                                                        disabled={isBatchActionPending}
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-400/40 text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
                                                    >
                                                        {isBatchActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                        <span>{t('details.actions.closeBatch')}</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleBatchAction('cancel')}
                                                        disabled={isBatchActionPending}
                                                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-rose-400/40 text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                                                    >
                                                        {isBatchActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                        <span>{t('details.actions.cancelBatch')}</span>
                                                    </button>
                                                </>
                                            )}

                                            {canWrite && selectedSurveyBatch.status === 'closed' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleBatchAction('reopen')}
                                                    disabled={isBatchActionPending}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
                                                >
                                                    {isBatchActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                    <span>{t('details.actions.reopenBatch')}</span>
                                                </button>
                                            )}

                                            {canWrite && selectedSurveyBatch.status !== 'collecting' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDeleteBatchError(null);
                                                        setIsDeleteBatchModalOpen(true);
                                                    }}
                                                    disabled={isBatchActionPending}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-rose-400/40 text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    <span>{t('details.actions.deleteBatch')}</span>
                                                </button>
                                            )}

                                            {canWrite && isBatchDraft && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsObjectEditing((current) => !current);
                                                        setObjectError(null);
                                                        setObjectName(selectedSurveyBatch.name);
                                                        setObjectImageType(selectedSurveyBatch.image_type ?? null);
                                                        setObjectImageId(selectedSurveyBatch.image_id ?? null);
                                                        setObjectImageBase64(selectedSurveyBatch.image_base64 ?? null);
                                                        setObjectImageFilename(null);
                                                    }}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                    <span>{t('details.actions.editObject')}</span>
                                                </button>
                                            )}

                                            {canWrite && isBatchDraft && (
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

                                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                        {t('details.serverManagedHint')}
                                    </p>
                                    {!isBatchDraft && (
                                        <p className={`text-xs ${isLight ? 'text-amber-600' : 'text-amber-300'}`}>
                                            {t('details.nonEditableState')}
                                        </p>
                                    )}

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

                                            <div className="space-y-2">
                                                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>Image</p>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/20 text-gray-200 hover:bg-white/10'}`}>
                                                        <span>Upload image</span>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            disabled={isObjectSaving}
                                                            onChange={(event) => {
                                                                const file = event.target.files?.[0] ?? null;
                                                                void handleObjectImageUpload(file);
                                                                event.target.value = '';
                                                            }}
                                                            className="sr-only"
                                                        />
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={clearObjectImage}
                                                        disabled={isObjectSaving || (!objectImageBase64 && !objectImageId)}
                                                        className={`inline-flex items-center rounded-md border px-3 py-1.5 text-xs ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/20 text-gray-200 hover:bg-white/10'} disabled:opacity-60`}
                                                    >
                                                        Remove image
                                                    </button>
                                                </div>
                                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                    {objectImageFilename
                                                        ? `Selected file: ${objectImageFilename}`
                                                        : objectImageId
                                                            ? `Current media id: ${objectImageId}`
                                                            : 'No image selected'}
                                                </p>
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
                                                        setObjectImageType(selectedSurveyBatch.image_type ?? null);
                                                        setObjectImageId(selectedSurveyBatch.image_id ?? null);
                                                        setObjectImageBase64(selectedSurveyBatch.image_base64 ?? null);
                                                        setObjectImageFilename(null);
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
                                                    <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(selectedSurveyBatch.created_at, timezone)}</p>
                                                </div>
                                                <div>
                                                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.updatedAt')}</p>
                                                    <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(selectedSurveyBatch.updated_at, timezone)}</p>
                                                </div>
                                            </div>

                                            <div className="text-xs">
                                                <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.creator')}</p>
                                                <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{selectedSurveyBatch.creator_account || '—'}</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Image</p>
                                                {selectedSurveyImageSrc ? (
                                                    <Image
                                                        src={selectedSurveyImageSrc}
                                                        alt="Survey batch image"
                                                        width={720}
                                                        height={360}
                                                        unoptimized
                                                        className="h-auto max-h-44 w-auto rounded-md border border-white/10 object-contain"
                                                    />
                                                ) : (
                                                    <p className={`text-xs ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                                        {selectedSurveyBatch.image_id
                                                            ? `Image uploaded with media id ${selectedSurveyBatch.image_id}`
                                                            : 'No image configured'}
                                                    </p>
                                                )}
                                                <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                    <p>image_type: {selectedSurveyBatch.image_type || '—'}</p>
                                                    <p>image_id: {selectedSurveyBatch.image_id || '—'}</p>
                                                </div>
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
                                            <option value="not_started">not_started</option>
                                            <option value="submitted">submitted</option>
                                            <option value="revoked">revoked</option>
                                            <option value="expired">expired</option>
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
                                                        disabled={!isRowMetadataEditable || isRowSaving || isRowDeleting}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-rose-400/40 text-rose-300 hover:bg-rose-500/20 disabled:opacity-60"
                                                    >
                                                        {isRowDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                        <span>{t('details.rowEditor.actions.delete')}</span>
                                                    </button>
                                                )}
                                                {canSubmitRowAction && (
                                                    <button
                                                        type="button"
                                                        onClick={handleSubmitRowAction}
                                                        disabled={!canWrite || isRowSaving || isRowDeleting}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
                                                    >
                                                        {isRowSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                                        <span>{t('details.rowEditor.actions.submit')}</span>
                                                    </button>
                                                )}
                                                {canRevokeRowAction && (
                                                    <button
                                                        type="button"
                                                        onClick={handleRevokeRowAction}
                                                        disabled={!canWrite || isRowSaving || isRowDeleting}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-400/40 text-amber-300 hover:bg-amber-500/20 disabled:opacity-60"
                                                    >
                                                        {isRowSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                                        <span>{t('details.rowEditor.actions.revoke')}</span>
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
                                                    disabled={!isRowMetadataEditable || isRowSaving || isRowDeleting}
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
                                                disabled={rowEditorMode === 'edit' || isRowSaving || isRowDeleting || !isRowMetadataEditable}
                                                className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('details.rowEditor.fields.status')}</label>
                                                <span className={`inline-block px-2 py-1 rounded-md text-xs border ${getSurveyStatusClass(rowStatus)}`}>
                                                    {rowStatus}
                                                </span>
                                            </div>

                                            <div>
                                                <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('details.rowEditor.fields.submittedAt')}</label>
                                                <p className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900 bg-slate-50' : 'border-white/10 bg-slate-900/80 text-white'}`}>
                                                    {rowEditorMode === 'edit' && editingSurveyOid
                                                        ? formatDateTime(details.find((item) => item.oid === editingSurveyOid)?.submitted_at ?? null, timezone)
                                                        : '—'}
                                                </p>
                                            </div>
                                        </div>

                                        {(rowCreatedAt || rowUpdatedAt) && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.createdAt')}</p>
                                                    <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(rowCreatedAt, timezone)}</p>
                                                </div>
                                                <div>
                                                    <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.updatedAt')}</p>
                                                    <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(rowUpdatedAt, timezone)}</p>
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <p className={`text-xs mb-2 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('details.rowEditor.fields.questions')}</p>
                                            {showSurveyQuestionBuilder ? (
                                                <SurveyQuestionBuilder
                                                    intro={rowIntro}
                                                    onIntroChange={setRowIntro}
                                                    questions={rowQuestions}
                                                    onQuestionsChange={setRowQuestions}
                                                    disabled={isRowSaving || isRowDeleting || !isRowMetadataEditable}
                                                />
                                            ) : showInlineQuestionAnswerView ? (
                                                <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                                                    {rowSurveyQuestions.intro.trim().length > 0 && (
                                                        <div className={`rounded-md border p-3 text-sm whitespace-pre-wrap ${isLight ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-white/10 bg-slate-900/60 text-gray-200'}`}>
                                                            {formatSurveyIntro(rowSurveyQuestions.intro, timezone)}
                                                        </div>
                                                    )}

                                                    <div className="space-y-3">
                                                        {rowSurveyQuestions.questions.map((question, questionIndex) => {
                                                            const questionAnswer = getSurveyAnswerForQuestion(rowSurveyAnswer, question.question_id);
                                                            const questionLabel = `${t('questionBuilder.questionLabel')} #${questionIndex + 1}`;
                                                            const answerValue = questionAnswer && questionAnswer.type === question.type
                                                                ? questionAnswer
                                                                : null;
                                                            const textAnswerValue = answerValue && answerValue.type === 'text'
                                                                ? answerValue.text
                                                                : '';
                                                            const singleSelectAnswerValue = answerValue && answerValue.type === 'single_select'
                                                                ? answerValue.selected_option_id
                                                                : '';
                                                            const multiSelectAnswerValue = answerValue && answerValue.type === 'multi_select'
                                                                ? answerValue.selected_option_ids
                                                                : [];

                                                            return (
                                                                <article
                                                                    key={`${question.question_id}_${questionIndex}`}
                                                                    className={`rounded-lg border p-3 space-y-3 ${isLight ? 'border-slate-200' : 'border-white/10'}`}
                                                                >
                                                                    <div className="space-y-1">
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <p className={`text-sm font-medium ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                                                                {questionLabel}
                                                                            </p>
                                                                            <span className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                                                {question.type}
                                                                            </span>
                                                                        </div>
                                                                        <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                                            {question.question_id}
                                                                        </p>
                                                                        <p className={`text-sm whitespace-pre-wrap ${isLight ? 'text-slate-800' : 'text-gray-100'}`}>
                                                                            {question.title}
                                                                            {question.required && (
                                                                                <span className={`${isLight ? 'text-rose-500' : 'text-rose-300'}`}> *</span>
                                                                            )}
                                                                        </p>
                                                                    </div>

                                                                    {isSubmittedSurveyRow ? (
                                                                        <div>
                                                                            <p className={`text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                                                                {t('details.fields.answer')}
                                                                            </p>
                                                                            <p className={`rounded-md border px-2 py-1.5 text-sm whitespace-pre-wrap ${isLight ? 'border-slate-300 bg-slate-50 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}>
                                                                                {formatSurveyAnswerValue(question, answerValue)}
                                                                            </p>
                                                                        </div>
                                                                    ) : question.type === 'text' ? (
                                                                        <div>
                                                                            <p className={`text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                                                                {t('details.fields.answer')}
                                                                            </p>
                                                                            <textarea
                                                                                value={textAnswerValue}
                                                                                onChange={(event) => {
                                                                                    const nextText = event.target.value;
                                                                                    upsertRowSurveyAnswer(
                                                                                        question.question_id,
                                                                                        nextText.trim().length > 0
                                                                                            ? {
                                                                                                question_id: question.question_id,
                                                                                                type: 'text',
                                                                                                text: nextText,
                                                                                            }
                                                                                            : null
                                                                                    );
                                                                                }}
                                                                                disabled={!isInlineAnswerEditable}
                                                                                rows={3}
                                                                                className={`w-full px-2 py-1.5 rounded-md border text-sm resize-y ${isLight ? 'border-slate-300 text-slate-900 bg-white' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                                                            />
                                                                        </div>
                                                                    ) : question.type === 'single_select' ? (
                                                                        <div>
                                                                            <p className={`text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                                                                {t('details.fields.answer')}
                                                                            </p>
                                                                            <select
                                                                                value={singleSelectAnswerValue}
                                                                                onChange={(event) => {
                                                                                    const nextValue = event.target.value;
                                                                                    upsertRowSurveyAnswer(
                                                                                        question.question_id,
                                                                                        nextValue.length > 0
                                                                                            ? {
                                                                                                question_id: question.question_id,
                                                                                                type: 'single_select',
                                                                                                selected_option_id: nextValue,
                                                                                            }
                                                                                            : null
                                                                                    );
                                                                                }}
                                                                                disabled={!isInlineAnswerEditable}
                                                                                className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900 bg-white' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                                                            >
                                                                                <option value="">—</option>
                                                                                {question.options.map((option) => (
                                                                                    <option key={option.option_id} value={option.option_id}>
                                                                                        {option.label}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="space-y-2">
                                                                            <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                                                                {t('details.fields.answer')}
                                                                            </p>
                                                                            {question.options.map((option) => {
                                                                                const checked = multiSelectAnswerValue.includes(option.option_id);
                                                                                return (
                                                                                    <label
                                                                                        key={option.option_id}
                                                                                        className={`flex items-center gap-2 text-sm ${isLight ? 'text-slate-800' : 'text-gray-100'}`}
                                                                                    >
                                                                                        <input
                                                                                            type="checkbox"
                                                                                            checked={checked}
                                                                                            onChange={(event) => {
                                                                                                const currentOptionIds = Array.isArray(multiSelectAnswerValue)
                                                                                                    ? multiSelectAnswerValue
                                                                                                    : [];
                                                                                                const nextOptionIds = event.target.checked
                                                                                                    ? [...currentOptionIds, option.option_id]
                                                                                                    : currentOptionIds.filter((optionId) => optionId !== option.option_id);
                                                                                                upsertRowSurveyAnswer(
                                                                                                    question.question_id,
                                                                                                    nextOptionIds.length > 0
                                                                                                        ? {
                                                                                                            question_id: question.question_id,
                                                                                                            type: 'multi_select',
                                                                                                            selected_option_ids: Array.from(new Set(nextOptionIds)),
                                                                                                        }
                                                                                                        : null
                                                                                                );
                                                                                            }}
                                                                                            disabled={!isInlineAnswerEditable}
                                                                                        />
                                                                                        <span>{option.label}</span>
                                                                                    </label>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </article>
                                                            );
                                                        })}
                                                    </div>
                                                </section>
                                            ) : null}
                                        </div>
                                    </section>
                                )}

                                <div className="flex flex-1 min-h-0">
                                    <div
                                        ref={surveyDetailsListRef}
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
                                                                {t('details.fields.submittedAt')}: {formatDateTime(detail.submitted_at, timezone)}
                                                            </p>
                                                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                                {t('details.fields.questions')}: {detail.survey_questions.questions.length}
                                                            </p>
                                                            <p className={`text-xs whitespace-pre-wrap break-words ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
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

            <DeleteBatchModal
                isOpen={isDeleteBatchModalOpen}
                batchName={selectedSurveyBatch?.name ?? ''}
                isPending={isBatchActionPending}
                error={deleteBatchError}
                onCancel={() => setIsDeleteBatchModalOpen(false)}
                onConfirm={handleDeleteBatch}
                labels={{
                    title: t('details.deleteModal.title'),
                    description: t('details.deleteModal.description', { name: selectedSurveyBatch?.name ?? '' }),
                    typeToConfirm: t('details.deleteModal.typeToConfirm'),
                    confirm: t('details.deleteModal.confirm'),
                    cancel: t('details.deleteModal.cancel'),
                }}
            />
        </SurveyAccessGate>
    );
}
