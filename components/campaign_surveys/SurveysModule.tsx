'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ClipboardCheck, Loader2, Pencil, Plus, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { usePermissions } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';
import type {
    SurveyAnswer,
    Survey,
    SurveyDetail,
    SurveyDetailStatus,
    SurveyQuestion,
    SurveyListResponse,
    SurveyStatus,
} from '@/lib/types/objects';
import { PaneQuickScrollButtons } from '@/components/campaign_shared/PaneQuickScrollButtons';
import { SurveyAccessGate } from './SurveyAccessGate';
import { getSurveyDetailStatusClass, getSurveyStatusClass, summarizeSurveyAnswer } from './utils';

interface SurveyDetailListResponse {
    items: SurveyDetail[];
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

function formatSurveyAnswerValue(answer: SurveyAnswer, question: SurveyQuestion | undefined): string {
    if (answer.type === 'single_select') {
        if (question && (question.type === 'single_select' || question.type === 'multi_select')) {
            const option = question.options.find((item) => item.option_id === answer.selected_option_id);
            return option ? `${option.label} (${answer.selected_option_id})` : answer.selected_option_id;
        }
        return answer.selected_option_id;
    }

    if (answer.type === 'multi_select') {
        if (question && (question.type === 'single_select' || question.type === 'multi_select')) {
            const optionsById = new Map(question.options.map((item) => [item.option_id, item.label]));
            return answer.selected_option_ids
                .map((optionId) => optionsById.get(optionId) ? `${optionsById.get(optionId)} (${optionId})` : optionId)
                .join(', ');
        }
        return answer.selected_option_ids.join(', ');
    }

    return answer.text || '—';
}

export function SurveysModule() {
    const t = useTranslations('CampaignSurvey');
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { hasPermission } = usePermissions();
    const canWrite = hasPermission(PERMISSIONS.OBJECTS.SURVEYS_WRITE);

    const [statusFilter, setStatusFilter] = useState<SurveyStatus | ''>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [detailsStatusFilter, setDetailsStatusFilter] = useState<SurveyDetailStatus | ''>('');
    const [detailsSearch, setDetailsSearch] = useState('');

    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [surveysTotal, setSurveysTotal] = useState<number>(0);
    const [isSurveysLoading, setIsSurveysLoading] = useState(false);
    const [isSurveysLoadingMore, setIsSurveysLoadingMore] = useState(false);
    const [hasMoreSurveys, setHasMoreSurveys] = useState(true);
    const [surveysError, setSurveysError] = useState<string | null>(null);

    const [details, setDetails] = useState<SurveyDetail[]>([]);
    const [detailsTotal, setDetailsTotal] = useState<number>(0);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [isDetailsLoadingMore, setIsDetailsLoadingMore] = useState(false);
    const [hasMoreDetails, setHasMoreDetails] = useState(true);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const [selectedDetailStableId, setSelectedDetailStableId] = useState<string | null>(null);

    const surveysListRef = useRef<HTMLDivElement>(null);
    const surveyDetailsListRef = useRef<HTMLDivElement>(null);

    const selectedSurveyOid = searchParams.get('survey');

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

            const response = await fetch(`/api/campaigns/surveys?${params.toString()}`, {
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error(t('errors.loadSurveys'));
            }

            const payload = (await response.json()) as SurveyListResponse;
            const pageItems = Array.isArray(payload.items) ? payload.items : [];

            setSurveys((current) => {
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
                setSurveys([]);
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
        await fetchSurveysPage(surveys.length, false);
    }, [fetchSurveysPage, hasMoreSurveys, isSurveysLoading, isSurveysLoadingMore, surveys.length]);

    const fetchDetailsPage = useCallback(async (surveyOid: string, skip: number, replace: boolean) => {
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
                `/api/campaigns/surveys/${encodeURIComponent(surveyOid)}/details?${params.toString()}`,
                { cache: 'no-store' }
            );

            if (!response.ok) {
                throw new Error(t('errors.loadDetails'));
            }

            const payload = (await response.json()) as SurveyDetailListResponse;
            const pageItems = Array.isArray(payload.items) ? payload.items : [];

            setDetails((current) => {
                const base = replace ? [] : current;
                const seen = new Set(base.map((item) => item.receiver_stable_id));
                const additions = pageItems.filter((item) => {
                    if (seen.has(item.receiver_stable_id)) return false;
                    seen.add(item.receiver_stable_id);
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
        if (isDetailsLoading || isDetailsLoadingMore || !hasMoreDetails || !selectedSurveyOid) return;
        await fetchDetailsPage(selectedSurveyOid, details.length, false);
    }, [details.length, fetchDetailsPage, hasMoreDetails, isDetailsLoading, isDetailsLoadingMore, selectedSurveyOid]);

    useEffect(() => {
        void reloadSurveys();
    }, [reloadSurveys]);

    useEffect(() => {
        if (surveys.length === 0) return;
        if (!selectedSurveyOid || !surveys.some((item) => item.oid === selectedSurveyOid)) {
            setQueryParam('survey', surveys[0]?.oid ?? null);
        }
    }, [surveys, selectedSurveyOid, setQueryParam]);

    useEffect(() => {
        if (!selectedSurveyOid) {
            setDetails([]);
            setDetailsTotal(0);
            setHasMoreDetails(true);
            setSelectedDetailStableId(null);
            return;
        }
        setHasMoreDetails(true);
        void fetchDetailsPage(selectedSurveyOid, 0, true);
    }, [fetchDetailsPage, selectedSurveyOid]);

    useEffect(() => {
        const container = surveysListRef.current;
        if (!container) return;
        if (isSurveysLoading || isSurveysLoadingMore || !hasMoreSurveys) return;
        if (container.scrollHeight <= container.clientHeight + 1) {
            void loadMoreSurveys();
        }
    }, [hasMoreSurveys, isSurveysLoading, isSurveysLoadingMore, loadMoreSurveys, surveys.length]);

    useEffect(() => {
        const container = surveyDetailsListRef.current;
        if (!container) return;
        if (isDetailsLoading || isDetailsLoadingMore || !hasMoreDetails) return;
        if (container.scrollHeight <= container.clientHeight + 1) {
            void loadMoreDetails();
        }
    }, [details.length, hasMoreDetails, isDetailsLoading, isDetailsLoadingMore, loadMoreDetails]);

    const selectedSurvey = useMemo(
        () => surveys.find((survey) => survey.oid === selectedSurveyOid) ?? null,
        [surveys, selectedSurveyOid]
    );

    const filteredSurveys = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return surveys;
        return surveys.filter((item) => (
            item.name.toLowerCase().includes(query)
            || item.oid.toLowerCase().includes(query)
        ));
    }, [surveys, searchQuery]);

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
            setSelectedDetailStableId(null);
            return;
        }
        if (!selectedDetailStableId || !filteredDetails.some((item) => item.receiver_stable_id === selectedDetailStableId)) {
            setSelectedDetailStableId(filteredDetails[0].receiver_stable_id);
        }
    }, [filteredDetails, selectedDetailStableId]);

    const selectedDetail = useMemo(
        () => filteredDetails.find((item) => item.receiver_stable_id === selectedDetailStableId) ?? null,
        [filteredDetails, selectedDetailStableId]
    );

    const selectedSurveyQuestionsById = useMemo(() => {
        if (!selectedSurvey) return new Map<string, SurveyQuestion>();
        return new Map(selectedSurvey.survey_questions.questions.map((question) => [question.question_id, question]));
    }, [selectedSurvey]);

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
                                onChange={(event) => setStatusFilter(event.target.value as SurveyStatus | '')}
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
                                    onClick={() => router.push('/campaign/surveys/new')}
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
                                        const selected = item.oid === selectedSurveyOid;
                                        return (
                                            <button
                                                key={item.oid}
                                                type="button"
                                                onClick={() => setQueryParam('survey', item.oid)}
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
                        {!selectedSurvey ? (
                            <div className="h-full flex items-center justify-center text-sm text-gray-400">
                                {t('details.selectSurvey')}
                            </div>
                        ) : (
                            <>
                                <header className="p-4 border-b border-white/10 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{selectedSurvey.name}</h2>
                                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                {selectedSurvey.oid}
                                            </p>
                                        </div>

                                        {canWrite && (
                                            <button
                                                type="button"
                                                onClick={() => router.push(`/campaign/surveys/${selectedSurvey.oid}/edit`)}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20"
                                            >
                                                <Pencil className="w-4 h-4" />
                                                <span>{t('details.edit')}</span>
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <div>
                                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.status')}</p>
                                            <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{selectedSurvey.status}</p>
                                        </div>
                                        <div>
                                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.total')}</p>
                                            <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{selectedSurvey.total_count}</p>
                                        </div>
                                        <div>
                                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.createdAt')}</p>
                                            <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(selectedSurvey.created_at)}</p>
                                        </div>
                                        <div>
                                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.updatedAt')}</p>
                                            <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(selectedSurvey.updated_at)}</p>
                                        </div>
                                    </div>

                                    <select
                                        value={detailsStatusFilter}
                                        onChange={(event) => setDetailsStatusFilter(event.target.value as SurveyDetailStatus | '')}
                                        className={`w-full md:w-48 px-2 py-1.5 text-sm rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
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
                                        className={`w-full px-2 py-1.5 text-sm rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                    />

                                    <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                        {t('details.counts', {
                                            loaded: filteredDetails.length,
                                            total: detailsTotal,
                                        })}
                                    </p>
                                </header>

                                {selectedDetail && (
                                    <section className={`m-4 mb-3 rounded-lg border p-3 space-y-3 ${isLight ? 'border-slate-200 bg-slate-50/80' : 'border-white/10 bg-slate-900/40'}`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('details.fields.receiver')}</p>
                                                <p className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{selectedDetail.receiver_stable_id}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-xs border ${getSurveyDetailStatusClass(selectedDetail.status)}`}>
                                                {selectedDetail.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                            <div>
                                                <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.submittedAt')}</p>
                                                <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(selectedDetail.submitted_at)}</p>
                                            </div>
                                            <div>
                                                <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.createdAt')}</p>
                                                <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(selectedDetail.created_at)}</p>
                                            </div>
                                            <div>
                                                <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.updatedAt')}</p>
                                                <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(selectedDetail.updated_at)}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <p className={`text-xs mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('details.fields.questions')}</p>
                                            <ul className="space-y-1">
                                                {selectedSurvey?.survey_questions.questions.map((question) => (
                                                    <li key={question.question_id} className={`text-xs ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                                        <span className="font-medium">{question.question_id}</span>
                                                        <span className={isLight ? 'text-slate-500' : 'text-gray-400'}> · {question.type}</span>
                                                        <div className={isLight ? 'text-slate-600' : 'text-gray-300'}>{question.title}</div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        <div>
                                            <p className={`text-xs mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('details.fields.answer')}</p>
                                            {!selectedDetail.survey_answer || selectedDetail.survey_answer.answers.length === 0 ? (
                                                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>—</p>
                                            ) : (
                                                <ul className="space-y-1">
                                                    {selectedDetail.survey_answer.answers.map((answer, index) => {
                                                        const question = selectedSurveyQuestionsById.get(answer.question_id);
                                                        return (
                                                            <li key={`${answer.question_id}-${index}`} className={`text-xs ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                                                <span className="font-medium">{answer.question_id}</span>
                                                                {question && <span className={isLight ? 'text-slate-500' : 'text-gray-400'}> · {question.title}</span>}
                                                                <div className={isLight ? 'text-slate-600' : 'text-gray-300'}>
                                                                    {formatSurveyAnswerValue(answer, question)}
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}
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
                                                    const isSelected = detail.receiver_stable_id === selectedDetailStableId;
                                                    return (
                                                        <button
                                                            key={detail.receiver_stable_id}
                                                            type="button"
                                                            onClick={() => setSelectedDetailStableId(detail.receiver_stable_id)}
                                                            className={`w-full text-left px-4 py-3 hover:bg-white/5 ${isSelected ? 'bg-blue-500/10' : ''}`}
                                                        >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className={`text-sm font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>{detail.receiver_stable_id}</p>
                                                            <span className={`px-2 py-0.5 rounded-full text-xs border ${getSurveyDetailStatusClass(detail.status)}`}>
                                                                {detail.status}
                                                            </span>
                                                        </div>
                                                        <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                            {t('details.fields.submittedAt')}: {formatDateTime(detail.submitted_at)}
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
