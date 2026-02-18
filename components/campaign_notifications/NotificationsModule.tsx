'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
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
import { CampaignAccessGate } from './CampaignAccessGate';
import { getNotificationDetailStatusClass, getNotificationStatusClass, summarizeContentBlocks } from './utils';

interface NotificationDetailListResponse {
    items: NotificationDetail[];
    total: number;
    skip: number;
    limit: number;
}

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
    const [notificationsError, setNotificationsError] = useState<string | null>(null);

    const [details, setDetails] = useState<NotificationDetail[]>([]);
    const [detailsTotal, setDetailsTotal] = useState<number>(0);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);

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

    const fetchNotifications = useCallback(async () => {
        setIsNotificationsLoading(true);
        setNotificationsError(null);
        try {
            const params = new URLSearchParams();
            params.set('limit', '300');
            params.set('skip', '0');
            if (statusFilter) params.set('status', statusFilter);
            if (channelFilter) params.set('channel', channelFilter);

            const response = await fetch(`/api/campaigns/notifications?${params.toString()}`, {
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error(t('errors.loadNotifications'));
            }

            const payload = (await response.json()) as NotificationListResponse;
            setNotifications(payload.items);
            setNotificationsTotal(payload.total ?? payload.items.length);
        } catch (error) {
            const message = error instanceof Error ? error.message : t('errors.loadNotifications');
            setNotificationsError(message);
            setNotifications([]);
            setNotificationsTotal(0);
        } finally {
            setIsNotificationsLoading(false);
        }
    }, [channelFilter, statusFilter, t]);

    const fetchDetails = useCallback(async (notificationOid: string) => {
        setIsDetailsLoading(true);
        setDetailsError(null);

        try {
            const params = new URLSearchParams();
            params.set('limit', '1000');
            params.set('skip', '0');
            if (detailsStatusFilter) params.set('status', detailsStatusFilter);

            const response = await fetch(
                `/api/campaigns/notifications/${encodeURIComponent(notificationOid)}/details?${params.toString()}`,
                { cache: 'no-store' }
            );

            if (!response.ok) {
                throw new Error(t('errors.loadDetails'));
            }

            const payload = (await response.json()) as NotificationDetailListResponse;
            setDetails(payload.items);
            setDetailsTotal(payload.total ?? payload.items.length);
        } catch (error) {
            const message = error instanceof Error ? error.message : t('errors.loadDetails');
            setDetailsError(message);
            setDetails([]);
            setDetailsTotal(0);
        } finally {
            setIsDetailsLoading(false);
        }
    }, [detailsStatusFilter, t]);

    useEffect(() => {
        void fetchNotifications();
    }, [fetchNotifications]);

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
            return;
        }
        void fetchDetails(selectedNotificationOid);
    }, [fetchDetails, selectedNotificationOid]);

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

    const handleTrigger = () => {
        if (!selectedNotificationOid) return;
        startTriggerTransition(async () => {
            const result = await triggerCampaignNotificationAction(selectedNotificationOid);
            if (!result.success) {
                setDetailsError(result.error);
                return;
            }

            await fetchNotifications();
            await fetchDetails(selectedNotificationOid);
        });
    };

    return (
        <CampaignAccessGate>
            <div className="h-[calc(100vh-4rem)] p-4 overflow-hidden">
                <div className="h-full grid grid-cols-[360px_1fr] gap-4">
                    <section className={`h-full rounded-xl border flex flex-col ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <header className="p-4 border-b border-white/10 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <Megaphone className="w-4 h-4 text-blue-300" />
                                    <h1 className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('list.title')}</h1>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void fetchNotifications()}
                                    className={`p-1.5 rounded-md ${isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/10 text-gray-300'}`}
                                >
                                    <RefreshCw className={`w-4 h-4 ${isNotificationsLoading ? 'animate-spin' : ''}`} />
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

                        <div className="flex-1 overflow-y-auto">
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
                        </div>
                    </section>

                    <section className={`h-full rounded-xl border flex flex-col ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
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

                                <div className="flex-1 overflow-y-auto">
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
                                            {filteredDetails.map((detail) => (
                                                <div key={detail.receiver_stable_id} className="px-4 py-3">
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
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </section>
                </div>
            </div>
        </CampaignAccessGate>
    );
}
