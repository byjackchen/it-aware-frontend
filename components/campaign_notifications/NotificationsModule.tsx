'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Megaphone, Pencil, Plus, RefreshCw, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { usePermissions } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';
import type {
    Notification,
    NotificationChannel,
    NotificationDetail,
    NotificationDetailStatus,
    NotificationListResponse,
    NotificationStatus,
} from '@/lib/types/objects';
import { triggerCampaignNotificationAction } from '@/app/actions/campaigns';
import { PaneQuickScrollButtons } from '@/components/campaign_shared/PaneQuickScrollButtons';
import { CampaignAccessGate } from './CampaignAccessGate';
import { getNotificationDetailStatusClass, getNotificationStatusClass, summarizeContentBlocks } from './utils';

interface NotificationDetailListResponse {
    items: NotificationDetail[];
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

export function NotificationsModule() {
    const t = useTranslations('Campaign');
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { hasPermission } = usePermissions();
    const canWrite = hasPermission(PERMISSIONS.OBJECTS.NOTIFICATIONS_WRITE);

    const [isTriggerPending, startTriggerTransition] = useTransition();

    const [statusFilter, setStatusFilter] = useState<NotificationStatus | ''>('');
    const [channelFilter, setChannelFilter] = useState<NotificationChannel | ''>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [detailsStatusFilter, setDetailsStatusFilter] = useState<NotificationDetailStatus | ''>('');
    const [detailsSearch, setDetailsSearch] = useState('');

    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [notificationsTotal, setNotificationsTotal] = useState<number>(0);
    const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
    const [isNotificationsLoadingMore, setIsNotificationsLoadingMore] = useState(false);
    const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
    const [notificationsError, setNotificationsError] = useState<string | null>(null);

    const [details, setDetails] = useState<NotificationDetail[]>([]);
    const [detailsTotal, setDetailsTotal] = useState<number>(0);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [isDetailsLoadingMore, setIsDetailsLoadingMore] = useState(false);
    const [hasMoreDetails, setHasMoreDetails] = useState(true);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const [selectedDetailStableId, setSelectedDetailStableId] = useState<string | null>(null);

    const notificationsListRef = useRef<HTMLDivElement>(null);
    const notificationDetailsListRef = useRef<HTMLDivElement>(null);

    const selectedNotificationOid = searchParams.get('notification');

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

    const fetchNotificationsPage = useCallback(async (skip: number, replace: boolean) => {
        if (replace) {
            setIsNotificationsLoading(true);
        } else {
            setIsNotificationsLoadingMore(true);
        }
        setNotificationsError(null);

        try {
            const params = new URLSearchParams();
            params.set('limit', String(LIST_PAGE_SIZE));
            params.set('skip', String(skip));
            if (statusFilter) params.set('status', statusFilter);
            if (channelFilter) params.set('channel', channelFilter);

            const response = await fetch(`/api/campaigns/notifications?${params.toString()}`, {
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error(t('errors.loadNotifications'));
            }

            const payload = (await response.json()) as NotificationListResponse;
            const pageItems = Array.isArray(payload.items) ? payload.items : [];

            setNotifications((current) => {
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

                setNotificationsTotal(nextTotal);
                setHasMoreNotifications(nextHasMore);

                return next;
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : t('errors.loadNotifications');
            setNotificationsError(message);
            if (replace) {
                setNotifications([]);
                setNotificationsTotal(0);
                setHasMoreNotifications(true);
            }
        } finally {
            if (replace) {
                setIsNotificationsLoading(false);
            } else {
                setIsNotificationsLoadingMore(false);
            }
        }
    }, [channelFilter, statusFilter, t]);

    const reloadNotifications = useCallback(async () => {
        setHasMoreNotifications(true);
        await fetchNotificationsPage(0, true);
    }, [fetchNotificationsPage]);

    const loadMoreNotifications = useCallback(async () => {
        if (isNotificationsLoading || isNotificationsLoadingMore || !hasMoreNotifications) return;
        await fetchNotificationsPage(notifications.length, false);
    }, [fetchNotificationsPage, hasMoreNotifications, isNotificationsLoading, isNotificationsLoadingMore, notifications.length]);

    const fetchDetailsPage = useCallback(async (notificationOid: string, skip: number, replace: boolean) => {
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
                `/api/campaigns/notifications/${encodeURIComponent(notificationOid)}/details?${params.toString()}`,
                { cache: 'no-store' }
            );

            if (!response.ok) {
                throw new Error(t('errors.loadDetails'));
            }

            const payload = (await response.json()) as NotificationDetailListResponse;
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
        if (isDetailsLoading || isDetailsLoadingMore || !hasMoreDetails || !selectedNotificationOid) return;
        await fetchDetailsPage(selectedNotificationOid, details.length, false);
    }, [details.length, fetchDetailsPage, hasMoreDetails, isDetailsLoading, isDetailsLoadingMore, selectedNotificationOid]);

    useEffect(() => {
        void reloadNotifications();
    }, [reloadNotifications]);

    useEffect(() => {
        if (notifications.length === 0) return;
        if (!selectedNotificationOid || !notifications.some((item) => item.oid === selectedNotificationOid)) {
            setQueryParam('notification', notifications[0]?.oid ?? null);
        }
    }, [notifications, selectedNotificationOid, setQueryParam]);

    useEffect(() => {
        if (!selectedNotificationOid) {
            setDetails([]);
            setDetailsTotal(0);
            setHasMoreDetails(true);
            setSelectedDetailStableId(null);
            return;
        }
        setHasMoreDetails(true);
        void fetchDetailsPage(selectedNotificationOid, 0, true);
    }, [fetchDetailsPage, selectedNotificationOid]);

    useEffect(() => {
        const container = notificationsListRef.current;
        if (!container) return;
        if (isNotificationsLoading || isNotificationsLoadingMore || !hasMoreNotifications) return;
        if (container.scrollHeight <= container.clientHeight + 1) {
            void loadMoreNotifications();
        }
    }, [hasMoreNotifications, isNotificationsLoading, isNotificationsLoadingMore, loadMoreNotifications, notifications.length]);

    useEffect(() => {
        const container = notificationDetailsListRef.current;
        if (!container) return;
        if (isDetailsLoading || isDetailsLoadingMore || !hasMoreDetails) return;
        if (container.scrollHeight <= container.clientHeight + 1) {
            void loadMoreDetails();
        }
    }, [details.length, hasMoreDetails, isDetailsLoading, isDetailsLoadingMore, loadMoreDetails]);

    const selectedNotification = useMemo(
        () => notifications.find((notification) => notification.oid === selectedNotificationOid) ?? null,
        [notifications, selectedNotificationOid]
    );

    const filteredNotifications = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return notifications;
        return notifications.filter((item) => (
            item.name.toLowerCase().includes(query)
            || item.oid.toLowerCase().includes(query)
        ));
    }, [notifications, searchQuery]);

    const filteredDetails = useMemo(() => {
        const query = detailsSearch.trim().toLowerCase();
        if (!query) return details;
        return details.filter((item) => (
            item.receiver_stable_id.toLowerCase().includes(query)
            || summarizeContentBlocks(item.content_blocks).toLowerCase().includes(query)
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

    const handleNotificationsListScroll = useCallback(() => {
        const container = notificationsListRef.current;
        if (!container || isNotificationsLoading || isNotificationsLoadingMore || !hasMoreNotifications) return;
        const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (remaining <= LIST_SCROLL_LOAD_THRESHOLD) {
            void loadMoreNotifications();
        }
    }, [hasMoreNotifications, isNotificationsLoading, isNotificationsLoadingMore, loadMoreNotifications]);

    const handleNotificationDetailsListScroll = useCallback(() => {
        const container = notificationDetailsListRef.current;
        if (!container || isDetailsLoading || isDetailsLoadingMore || !hasMoreDetails) return;
        const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (remaining <= DETAILS_SCROLL_LOAD_THRESHOLD) {
            void loadMoreDetails();
        }
    }, [hasMoreDetails, isDetailsLoading, isDetailsLoadingMore, loadMoreDetails]);

    const handleTrigger = () => {
        if (!selectedNotificationOid) return;
        startTriggerTransition(async () => {
            const result = await triggerCampaignNotificationAction(selectedNotificationOid);
            if (!result.success) {
                setDetailsError(result.error);
                return;
            }

            await reloadNotifications();
            await fetchDetailsPage(selectedNotificationOid, 0, true);
        });
    };

    return (
        <CampaignAccessGate>
            <div className="h-[calc(100vh-4rem)] p-4 overflow-hidden">
                <div className="h-full min-h-0 grid grid-cols-[360px_1fr] gap-4">
                    <section className={`h-full min-h-0 rounded-xl border flex flex-col ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <header className="p-4 border-b border-white/10 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Megaphone className="w-4 h-4 text-blue-300" />
                                    <h1 className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('list.title')}</h1>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void reloadNotifications()}
                                    className={`p-1.5 rounded-md ${isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/10 text-gray-300'}`}
                                >
                                    <RefreshCw className={`w-4 h-4 ${(isNotificationsLoading || isNotificationsLoadingMore) ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <select
                                    value={statusFilter}
                                    onChange={(event) => setStatusFilter(event.target.value as NotificationStatus | '')}
                                    className={`px-2 py-1.5 text-sm rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                >
                                    <option value="">{t('list.filters.allStatus')}</option>
                                    <option value="created">created</option>
                                    <option value="processing">processing</option>
                                    <option value="partial">partial</option>
                                    <option value="completed">completed</option>
                                    <option value="completed_with_failures">completed_with_failures</option>
                                    <option value="cancelled">cancelled</option>
                                </select>

                                <select
                                    value={channelFilter}
                                    onChange={(event) => setChannelFilter(event.target.value as NotificationChannel | '')}
                                    className={`px-2 py-1.5 text-sm rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                >
                                    <option value="">{t('list.filters.allChannels')}</option>
                                    <option value="wecom_bot">wecom_bot</option>
                                    <option value="wecom_ops_bot">wecom_ops_bot</option>
                                </select>
                            </div>

                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder={t('list.filters.search')}
                                className={`w-full px-2 py-1.5 text-sm rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                            />

                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                {t('list.counts', {
                                    loaded: filteredNotifications.length,
                                    total: notificationsTotal,
                                })}
                            </p>

                            {canWrite && (
                                <button
                                    type="button"
                                    onClick={() => router.push('/campaign/notifications/new')}
                                    className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>{t('list.create')}</span>
                                </button>
                            )}
                        </header>

                        <div className="flex flex-1 min-h-0">
                            <div
                                ref={notificationsListRef}
                                onScroll={handleNotificationsListScroll}
                                className="flex-1 min-w-0 h-full overflow-y-auto campaign-pane-scroll-no-native"
                            >
                                {isNotificationsLoading && filteredNotifications.length === 0 ? (
                                    <div className="p-4 text-sm text-gray-300 inline-flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        {t('list.loading')}
                                    </div>
                                ) : notificationsError ? (
                                    <div className="p-4 text-sm text-rose-300">{notificationsError}</div>
                                ) : filteredNotifications.length === 0 ? (
                                    <div className="p-4 text-sm text-gray-400">{t('list.empty')}</div>
                                ) : (
                                    filteredNotifications.map((item) => {
                                        const selected = item.oid === selectedNotificationOid;
                                        return (
                                            <button
                                                key={item.oid}
                                                type="button"
                                                onClick={() => setQueryParam('notification', item.oid)}
                                                className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 ${selected ? 'bg-blue-500/10' : ''}`}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={`text-sm font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>{item.name}</p>
                                                    <span className={`px-2 py-0.5 rounded-full text-xs border ${getNotificationStatusClass(item.status)}`}>
                                                        {item.status}
                                                    </span>
                                                </div>
                                                <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{item.channel}</p>
                                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                    {t('details.fields.creator')}: {item.creator_account || '—'}
                                                </p>
                                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                    {t('details.fields.createdAt')}: {formatDateTime(item.created_at)}
                                                </p>
                                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                    {t('details.fields.updatedAt')}: {formatDateTime(item.updated_at)}
                                                </p>
                                            </button>
                                        );
                                    })
                                )}

                                {isNotificationsLoadingMore && (
                                    <div className={`p-3 text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'} inline-flex items-center gap-2`}>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        {t('list.loading')}
                                    </div>
                                )}
                            </div>

                            <PaneQuickScrollButtons containerRef={notificationsListRef} isLight={isLight} />
                        </div>
                    </section>

                    <section className={`h-full min-h-0 rounded-xl border flex flex-col ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        {!selectedNotification ? (
                            <div className="h-full flex items-center justify-center text-sm text-gray-400">
                                {t('details.selectNotification')}
                            </div>
                        ) : (
                            <>
                                <header className="p-4 border-b border-white/10 space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{selectedNotification.name}</h2>
                                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                {selectedNotification.oid}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {canWrite && selectedNotification.status === 'created' && (
                                                <button
                                                    type="button"
                                                    onClick={handleTrigger}
                                                    disabled={isTriggerPending}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                                                >
                                                    {isTriggerPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                    <span>{t('details.trigger')}</span>
                                                </button>
                                            )}

                                            {canWrite && (
                                                <button
                                                    type="button"
                                                    onClick={() => router.push(`/campaign/notifications/${selectedNotification.oid}/edit`)}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                    <span>{t('details.edit')}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-4 gap-2 text-xs">
                                        <div>
                                            <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.status')}</p>
                                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full border ${getNotificationStatusClass(selectedNotification.status)}`}>
                                                {selectedNotification.status}
                                            </span>
                                        </div>
                                        <div>
                                            <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.channel')}</p>
                                            <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{selectedNotification.channel}</p>
                                        </div>
                                        <div>
                                            <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.total')}</p>
                                            <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{selectedNotification.total_count}</p>
                                        </div>
                                        <div>
                                            <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.runId')}</p>
                                            <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'} truncate`}>{selectedNotification.run_id || '—'}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.creator')}</p>
                                            <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{selectedNotification.creator_account || '—'}</p>
                                        </div>
                                        <div>
                                            <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.createdAt')}</p>
                                            <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(selectedNotification.created_at)}</p>
                                        </div>
                                        <div>
                                            <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.updatedAt')}</p>
                                            <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(selectedNotification.updated_at)}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={detailsStatusFilter}
                                            onChange={(event) => setDetailsStatusFilter(event.target.value as NotificationDetailStatus | '')}
                                            className={`px-2 py-1.5 text-sm rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                        >
                                            <option value="">{t('details.filters.allStatus')}</option>
                                            <option value="created">created</option>
                                            <option value="sent">sent</option>
                                            <option value="failed">failed</option>
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

                                {selectedDetail && (
                                    <section className={`m-4 mb-3 rounded-lg border p-3 space-y-3 ${isLight ? 'border-slate-200 bg-slate-50/80' : 'border-white/10 bg-slate-900/40'}`}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('details.fields.receiver')}</p>
                                                <p className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{selectedDetail.receiver_stable_id}</p>
                                            </div>
                                            <span className={`px-2 py-0.5 rounded-full text-xs border ${getNotificationDetailStatusClass(selectedDetail.status)}`}>
                                                {selectedDetail.status}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                                            <div>
                                                <p className={`${isLight ? 'text-slate-500' : 'text-gray-500'}`}>{t('details.fields.scheduledAt')}</p>
                                                <p className={`${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{formatDateTime(selectedDetail.scheduled_at)}</p>
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
                                            <p className={`text-xs mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('details.fields.content')}</p>
                                            <pre className={`max-h-40 overflow-auto rounded-md border px-2 py-1.5 text-xs whitespace-pre-wrap break-words ${isLight ? 'border-slate-200 bg-white text-slate-700' : 'border-white/10 bg-slate-950/60 text-gray-200'}`}>
                                                {JSON.stringify(selectedDetail.content_blocks, null, 2)}
                                            </pre>
                                        </div>

                                        {selectedDetail.error_message && (
                                            <p className="text-xs text-rose-300">{selectedDetail.error_message}</p>
                                        )}
                                    </section>
                                )}

                                <div className="flex flex-1 min-h-0">
                                    <div
                                        ref={notificationDetailsListRef}
                                        onScroll={handleNotificationDetailsListScroll}
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
                                                            <span className={`px-2 py-0.5 rounded-full text-xs border ${getNotificationDetailStatusClass(detail.status)}`}>
                                                                {detail.status}
                                                            </span>
                                                        </div>
                                                        <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                                                            {summarizeContentBlocks(detail.content_blocks)}
                                                        </p>
                                                        <p className={`text-xs mt-1 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                            {t('details.fields.scheduledAt')}: {formatDateTime(detail.scheduled_at)}
                                                        </p>
                                                        {detail.error_message && (
                                                            <p className="text-xs mt-1 text-rose-300">{detail.error_message}</p>
                                                        )}
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

                                    <PaneQuickScrollButtons containerRef={notificationDetailsListRef} isLight={isLight} />
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </div>
        </CampaignAccessGate>
    );
}
