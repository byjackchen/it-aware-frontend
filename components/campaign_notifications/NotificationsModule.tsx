'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Loader2, Megaphone, Pencil, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { usePermissions } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';
import type {
    Notification,
    NotificationBatch,
    NotificationBatchChannel,
    NotificationBatchListResponse,
    NotificationBatchStatus,
    NotificationContentBlock,
    NotificationStatus,
} from '@/lib/types/objects';
import {
    cancelCampaignNotificationBatchAction,
    createCampaignNotificationAction,
    deleteCampaignNotificationAction,
    triggerCampaignNotificationBatchAction,
    updateCampaignNotificationAction,
    updateCampaignNotificationBatchAction,
} from '@/app/actions/campaigns';
import { PaneQuickScrollButtons } from '@/components/campaign_shared';
import { CampaignAccessGate } from './CampaignAccessGate';
import { NotificationContentBlocksEditor } from './NotificationContentBlocksEditor';
import { cloneContentBlocks, createEmptyBlock, getNotificationStatusClass, getNotificationStatusRowClass, summarizeContentBlocks } from './utils';

interface NotificationChildListResponse {
    items: Notification[];
    total: number;
    skip: number;
    limit: number;
}

const LIST_PAGE_SIZE = 300;
const DETAILS_PAGE_SIZE = 500;

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

function hasInvalidContentBlocks(blocks: NotificationContentBlock[]): boolean {
    return blocks.some((block) => {
        if (block.text.trim().length === 0) return true;
        if (block.type === 'link' && block.url.trim().length === 0) return true;
        return false;
    });
}

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

export function NotificationsModule() {
    const t = useTranslations('Campaign');
    const { theme } = useTheme();
    const isLight = theme === 'light';
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { hasPermission } = usePermissions();
    const canWrite = hasPermission(PERMISSIONS.OBJECTS.NOTIFICATION_BATCHS_WRITE);

    const [isBatchActionPending, startBatchActionTransition] = useTransition();
    const [isObjectSaving, startObjectSavingTransition] = useTransition();
    const [isRowSaving, startRowSavingTransition] = useTransition();
    const [isRowDeleting, startRowDeletingTransition] = useTransition();

    const [statusFilter, setStatusFilter] = useState<NotificationBatchStatus | ''>('');
    const [channelFilter, setChannelFilter] = useState<NotificationBatchChannel | ''>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [detailsStatusFilter, setDetailsStatusFilter] = useState<NotificationStatus | ''>('');
    const [detailsSearch, setDetailsSearch] = useState('');

    const [notificationBatches, setNotificationBatches] = useState<NotificationBatch[]>([]);
    const [selectedNotificationBatchDetail, setSelectedNotificationBatchDetail] = useState<NotificationBatch | null>(null);
    const [notificationsTotal, setNotificationsTotal] = useState<number>(0);
    const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
    const [isNotificationsLoadingMore, setIsNotificationsLoadingMore] = useState(false);
    const [hasMoreNotifications, setHasMoreNotifications] = useState(true);
    const [notificationsError, setNotificationsError] = useState<string | null>(null);

    const [details, setDetails] = useState<Notification[]>([]);
    const [detailsTotal, setDetailsTotal] = useState<number>(0);
    const [isDetailsLoading, setIsDetailsLoading] = useState(false);
    const [isDetailsLoadingMore, setIsDetailsLoadingMore] = useState(false);
    const [hasMoreDetails, setHasMoreDetails] = useState(true);
    const [detailsError, setDetailsError] = useState<string | null>(null);

    const [selectedNotificationOid, setSelectedNotificationOid] = useState<string | null>(null);

    const [isObjectEditing, setIsObjectEditing] = useState(false);
    const [objectName, setObjectName] = useState('');
    const [objectChannel, setObjectChannel] = useState<NotificationBatchChannel>('wecom_bot');
    const [objectImageType, setObjectImageType] = useState<string | null>(null);
    const [objectImageId, setObjectImageId] = useState<string | null>(null);
    const [objectImageBase64, setObjectImageBase64] = useState<string | null>(null);
    const [objectImageFilename, setObjectImageFilename] = useState<string | null>(null);
    const [objectError, setObjectError] = useState<string | null>(null);

    const [isRowEditorOpen, setIsRowEditorOpen] = useState(false);
    const [rowEditorMode, setRowEditorMode] = useState<'create' | 'edit'>('edit');
    const [editingNotificationOid, setEditingNotificationOid] = useState<string | null>(null);
    const [rowReceiverStableId, setRowReceiverStableId] = useState('');
    const [rowContentBlocks, setRowContentBlocks] = useState<NotificationContentBlock[]>([createEmptyBlock('text')]);
    const [rowStatus, setRowStatus] = useState<NotificationStatus>('created');
    const [rowScheduledAt, setRowScheduledAt] = useState('');
    const [rowServerErrorMessage, setRowServerErrorMessage] = useState('');
    const [rowCreatedAt, setRowCreatedAt] = useState<string | null>(null);
    const [rowUpdatedAt, setRowUpdatedAt] = useState<string | null>(null);
    const [rowError, setRowError] = useState<string | null>(null);

    const notificationsListRef = useRef<HTMLDivElement>(null);
    const notificationDetailsListRef = useRef<HTMLDivElement>(null);

    const selectedNotificationBatchOid = searchParams.get('notificationBatch');

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

    const fetchNotificationBatchDetail = useCallback(async (notificationBatchOid: string) => {
        try {
            const response = await fetch(`/api/campaigns/notification_batchs/${encodeURIComponent(notificationBatchOid)}`, {
                cache: 'no-store',
            });
            if (!response.ok) {
                throw new Error(t('errors.loadNotifications'));
            }

            const payload = (await response.json()) as NotificationBatch;
            setSelectedNotificationBatchDetail(payload);
        } catch (error) {
            const message = error instanceof Error ? error.message : t('errors.loadNotifications');
            setDetailsError(message);
            setSelectedNotificationBatchDetail(null);
        }
    }, [t]);

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

            const response = await fetch(`/api/campaigns/notification_batchs?${params.toString()}`, {
                cache: 'no-store',
            });

            if (!response.ok) {
                throw new Error(t('errors.loadNotifications'));
            }

            const payload = (await response.json()) as NotificationBatchListResponse;
            const pageItems = Array.isArray(payload.items) ? payload.items : [];

            setNotificationBatches((current) => {
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

                setNotificationsTotal(nextTotal);
                setHasMoreNotifications(nextHasMore);

                return next;
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : t('errors.loadNotifications');
            setNotificationsError(message);
            if (replace) {
                setNotificationBatches([]);
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
        await fetchNotificationsPage(notificationBatches.length, false);
    }, [fetchNotificationsPage, hasMoreNotifications, isNotificationsLoading, isNotificationsLoadingMore, notificationBatches.length]);

    const fetchDetailsPage = useCallback(async (notificationBatchOid: string, skip: number, replace: boolean) => {
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
                `/api/campaigns/notification_batchs/${encodeURIComponent(notificationBatchOid)}/notifications?${params.toString()}`,
                { cache: 'no-store' }
            );

            if (!response.ok) {
                throw new Error(t('errors.loadDetails'));
            }

            const payload = (await response.json()) as NotificationChildListResponse;
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
        if (isDetailsLoading || isDetailsLoadingMore || !hasMoreDetails || !selectedNotificationBatchOid) return;
        await fetchDetailsPage(selectedNotificationBatchOid, details.length, false);
    }, [details.length, fetchDetailsPage, hasMoreDetails, isDetailsLoading, isDetailsLoadingMore, selectedNotificationBatchOid]);

    useEffect(() => {
        void reloadNotifications();
    }, [reloadNotifications]);

    useEffect(() => {
        if (notificationBatches.length === 0) return;
        if (!selectedNotificationBatchOid || !notificationBatches.some((item) => item.oid === selectedNotificationBatchOid)) {
            setQueryParam('notificationBatch', notificationBatches[0]?.oid ?? null);
        }
    }, [notificationBatches, selectedNotificationBatchOid, setQueryParam]);

    useEffect(() => {
        if (!selectedNotificationBatchOid) {
            setSelectedNotificationBatchDetail(null);
            setDetails([]);
            setDetailsTotal(0);
            setHasMoreDetails(true);
            setSelectedNotificationOid(null);
            return;
        }
        void fetchNotificationBatchDetail(selectedNotificationBatchOid);
        setHasMoreDetails(true);
        void fetchDetailsPage(selectedNotificationBatchOid, 0, true);
    }, [fetchDetailsPage, fetchNotificationBatchDetail, selectedNotificationBatchOid]);

    const selectedNotificationListItem = useMemo(
        () => notificationBatches.find((notification) => notification.oid === selectedNotificationBatchOid) ?? null,
        [notificationBatches, selectedNotificationBatchOid]
    );
    const selectedNotification = useMemo(() => {
        if (selectedNotificationBatchDetail && selectedNotificationBatchDetail.oid === selectedNotificationBatchOid) {
            return selectedNotificationBatchDetail;
        }
        return selectedNotificationListItem;
    }, [selectedNotificationBatchDetail, selectedNotificationBatchOid, selectedNotificationListItem]);
    const isBatchMetadataEditable = selectedNotification?.status === 'ready';
    const shouldAutoRefreshBatch = selectedNotification?.status === 'running';

    useEffect(() => {
        if (!selectedNotification) return;
        setObjectName(selectedNotification.name);
        setObjectChannel(selectedNotification.channel);
        setObjectImageType(selectedNotification.image_type ?? null);
        setObjectImageId(selectedNotification.image_id ?? null);
        setObjectImageBase64(selectedNotification.image_base64 ?? null);
        setObjectImageFilename(null);
        setObjectError(null);
        setIsObjectEditing(false);
    }, [selectedNotification]);

    useEffect(() => {
        setIsRowEditorOpen(false);
        setRowError(null);
    }, [selectedNotificationBatchOid]);

    useEffect(() => {
        if (!selectedNotificationBatchOid || !shouldAutoRefreshBatch) return;

        const intervalId = window.setInterval(() => {
            if (document.visibilityState !== 'visible') return;

            void (async () => {
                await reloadNotifications();
                await fetchNotificationBatchDetail(selectedNotificationBatchOid);
            })();
        }, 8_000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [fetchNotificationBatchDetail, reloadNotifications, selectedNotificationBatchOid, shouldAutoRefreshBatch]);

    const normalizedSearchQuery = searchQuery.trim();

    const filteredNotifications = useMemo(() => {
        const query = normalizedSearchQuery.toLowerCase();
        if (!query) return notificationBatches;
        return notificationBatches.filter((item) => (
            item.name.toLowerCase().includes(query)
            || item.oid.toLowerCase().includes(query)
        ));
    }, [notificationBatches, normalizedSearchQuery]);

    const filteredDetails = useMemo(() => {
        const query = detailsSearch.trim().toLowerCase();
        if (!query) return details;
        return details.filter((item) => (
            item.receiver_stable_id.toLowerCase().includes(query)
            || summarizeContentBlocks(item.content_blocks).toLowerCase().includes(query)
        ));
    }, [details, detailsSearch]);

    const selectedNotificationImageSrc = useMemo(
        () => toImageSrc(selectedNotification?.image_base64, selectedNotification?.image_type),
        [selectedNotification?.image_base64, selectedNotification?.image_type]
    );

    useEffect(() => {
        if (filteredDetails.length === 0) {
            setSelectedNotificationOid(null);
            return;
        }
        if (!selectedNotificationOid || !filteredDetails.some((item) => item.oid === selectedNotificationOid)) {
            setSelectedNotificationOid(filteredDetails[0].oid);
        }
    }, [filteredDetails, selectedNotificationOid]);

    useEffect(() => {
        if (notificationsError) return;
        if (isNotificationsLoading || isNotificationsLoadingMore || !hasMoreNotifications) return;
        if (notificationBatches.length === 0) return;
        void loadMoreNotifications();
    }, [
        hasMoreNotifications,
        isNotificationsLoading,
        isNotificationsLoadingMore,
        loadMoreNotifications,
        notificationBatches.length,
        notificationsError,
    ]);

    useEffect(() => {
        if (!selectedNotificationBatchOid) return;
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
        selectedNotificationBatchOid,
    ]);

    const clearObjectImage = useCallback(() => {
        setObjectImageType(null);
        setObjectImageId(null);
        setObjectImageBase64(null);
        setObjectImageFilename(null);
    }, []);

    const handleObjectChannelChange = useCallback((channel: NotificationBatchChannel) => {
        setObjectChannel(channel);
        if (channel === 'wecom_ops_bot') {
            clearObjectImage();
        }
    }, [clearObjectImage]);

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

    const handleTrigger = () => {
        if (!selectedNotificationBatchOid) return;
        startBatchActionTransition(async () => {
            const result = await triggerCampaignNotificationBatchAction(selectedNotificationBatchOid);
            if (!result.success) {
                setDetailsError(result.error);
                return;
            }

            await reloadNotifications();
            await fetchNotificationBatchDetail(selectedNotificationBatchOid);
            await fetchDetailsPage(selectedNotificationBatchOid, 0, true);
        });
    };

    const handleCancelBatch = () => {
        if (!selectedNotificationBatchOid) return;
        startBatchActionTransition(async () => {
            const result = await cancelCampaignNotificationBatchAction(selectedNotificationBatchOid);
            if (!result.success) {
                setDetailsError(result.error);
                return;
            }

            await reloadNotifications();
            await fetchNotificationBatchDetail(selectedNotificationBatchOid);
            await fetchDetailsPage(selectedNotificationBatchOid, 0, true);
        });
    };

    const openCreateRowEditor = () => {
        const sourceBlocks = details[0] ? cloneContentBlocks(details[0].content_blocks) : [createEmptyBlock('text')];
        setRowEditorMode('create');
        setEditingNotificationOid(null);
        setRowReceiverStableId('');
        setRowContentBlocks(sourceBlocks);
        setRowStatus('created');
        setRowScheduledAt('');
        setRowServerErrorMessage('');
        setRowCreatedAt(null);
        setRowUpdatedAt(null);
        setRowError(isBatchMetadataEditable ? null : t('details.serverManagedStatus'));
        setIsRowEditorOpen(true);
    };

    const openEditRowEditor = (detail: Notification) => {
        setSelectedNotificationOid(detail.oid);
        setRowEditorMode('edit');
        setEditingNotificationOid(detail.oid);
        setRowReceiverStableId(detail.receiver_stable_id);
        setRowContentBlocks(cloneContentBlocks(detail.content_blocks));
        setRowStatus(detail.status);
        setRowScheduledAt(toDateTimeInputValue(detail.scheduled_at));
        setRowServerErrorMessage(detail.error_message ?? '');
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

    const handleSaveObject = () => {
        if (!selectedNotification) return;
        if (!isBatchMetadataEditable) {
            setObjectError(t('details.serverManagedStatus'));
            return;
        }

        const nextName = objectName.trim();
        if (nextName.length === 0) {
            setObjectError(t('edit.errors.emptyName'));
            return;
        }

        const isOpsBotChannel = objectChannel === 'wecom_ops_bot';
        const normalizedImageBase64 = isOpsBotChannel
            ? null
            : toPureBase64(objectImageBase64);
        const normalizedImageType = isOpsBotChannel
            ? null
            : (objectImageType?.trim() || inferMimeTypeFromDataUrl(objectImageBase64) || null);
        const normalizedImageId = isOpsBotChannel
            ? null
            : (objectImageId?.trim() || null);

        setObjectError(null);
        startObjectSavingTransition(async () => {
            const result = await updateCampaignNotificationBatchAction(selectedNotification.oid, {
                name: nextName,
                channel: objectChannel,
                image_type: normalizedImageType,
                image_id: normalizedImageId,
                image_base64: normalizedImageBase64,
            });

            if (!result.success) {
                setObjectError(result.error);
                return;
            }

            setIsObjectEditing(false);
            await reloadNotifications();
            await fetchNotificationBatchDetail(selectedNotification.oid);
            await fetchDetailsPage(selectedNotification.oid, 0, true);
        });
    };

    const handleSaveRow = () => {
        if (!selectedNotification) return;
        if (!isBatchMetadataEditable) {
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

        if (hasInvalidContentBlocks(rowContentBlocks)) {
            setRowError(t('edit.errors.invalidContent'));
            return;
        }

        if (rowEditorMode === 'edit' && !editingNotificationOid) {
            setRowError(t('errors.loadDetails'));
            return;
        }

        setRowError(null);

        const payload = {
            content_blocks: cloneContentBlocks(rowContentBlocks),
            scheduled_at: fromDateTimeInputValue(rowScheduledAt),
        };

        startRowSavingTransition(async () => {
            const result = rowEditorMode === 'create'
                ? await createCampaignNotificationAction(selectedNotification.oid, {
                    receiver_stable_id: receiverStableId,
                    ...payload,
                })
                : await updateCampaignNotificationAction(
                    selectedNotification.oid,
                    editingNotificationOid as string,
                    payload
                );

            if (!result.success) {
                setRowError(result.error);
                return;
            }

            setIsRowEditorOpen(false);
            await fetchDetailsPage(selectedNotification.oid, 0, true);
            await reloadNotifications();
        });
    };

    const handleDeleteRow = () => {
        if (!selectedNotification || rowEditorMode !== 'edit' || !editingNotificationOid) return;
        if (!isBatchMetadataEditable) {
            setRowError(t('details.serverManagedStatus'));
            return;
        }

        setRowError(null);
        startRowDeletingTransition(async () => {
            const result = await deleteCampaignNotificationAction(
                selectedNotification.oid,
                editingNotificationOid
            );

            if (!result.success) {
                setRowError(result.error);
                return;
            }

            setIsRowEditorOpen(false);
            await fetchDetailsPage(selectedNotification.oid, 0, true);
            await reloadNotifications();
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
                                    onChange={(event) => setStatusFilter(event.target.value as NotificationBatchStatus | '')}
                                    className={`px-2 py-1.5 text-sm rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                >
                                    <option value="">{t('list.filters.allStatus')}</option>
                                    <option value="ready">ready</option>
                                    <option value="running">running</option>
                                    <option value="partially_completed">partially_completed</option>
                                    <option value="completed">completed</option>
                                    <option value="cancelled">cancelled</option>
                                </select>

                                <select
                                    value={channelFilter}
                                    onChange={(event) => setChannelFilter(event.target.value as NotificationBatchChannel | '')}
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
                                    onClick={() => router.push('/campaign/notification-batches/new')}
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
                                        const selected = item.oid === selectedNotificationBatchOid;
                                        return (
                                            <button
                                                key={item.oid}
                                                type="button"
                                                onClick={() => setQueryParam('notificationBatch', item.oid)}
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
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{selectedNotification.name}</h2>
                                            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                {selectedNotification.oid}
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {canWrite && (selectedNotification.status === 'ready' || selectedNotification.status === 'partially_completed') && (
                                                <button
                                                    type="button"
                                                    onClick={handleTrigger}
                                                    disabled={isBatchActionPending}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                                                >
                                                    {isBatchActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                    <span>{t('details.trigger')}</span>
                                                </button>
                                            )}

                                            {canWrite && (selectedNotification.status === 'ready' || selectedNotification.status === 'running') && (
                                                <button
                                                    type="button"
                                                    onClick={handleCancelBatch}
                                                    disabled={isBatchActionPending}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-rose-400/40 text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                                                >
                                                    {isBatchActionPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                                    <span>{t('details.actions.cancelBatch')}</span>
                                                </button>
                                            )}

                                            {canWrite && isBatchMetadataEditable && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsObjectEditing((current) => !current);
                                                        setObjectError(null);
                                                        setObjectName(selectedNotification.name);
                                                        setObjectChannel(selectedNotification.channel);
                                                        setObjectImageType(selectedNotification.image_type ?? null);
                                                        setObjectImageId(selectedNotification.image_id ?? null);
                                                        setObjectImageBase64(selectedNotification.image_base64 ?? null);
                                                        setObjectImageFilename(null);
                                                    }}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                    <span>{t('details.actions.editObject')}</span>
                                                </button>
                                            )}

                                            {canWrite && isBatchMetadataEditable && (
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
                                    {!isBatchMetadataEditable && (
                                        <p className={`text-xs ${isLight ? 'text-amber-600' : 'text-amber-300'}`}>
                                            {t('details.nonEditableState')}
                                        </p>
                                    )}

                                    {isObjectEditing ? (
                                        <div className="space-y-3 rounded-lg border border-white/10 p-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('edit.fields.name')}</label>
                                                    <input
                                                        type="text"
                                                        value={objectName}
                                                        onChange={(event) => setObjectName(event.target.value)}
                                                        disabled={isObjectSaving || !isBatchMetadataEditable}
                                                        className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                                    />
                                                </div>
                                                <div>
                                                    <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('edit.fields.channel')}</label>
                                                    <select
                                                        value={objectChannel}
                                                        onChange={(event) => handleObjectChannelChange(event.target.value as NotificationBatchChannel)}
                                                        disabled={isObjectSaving || !isBatchMetadataEditable}
                                                        className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                                    >
                                                        <option value="wecom_bot">wecom_bot</option>
                                                        <option value="wecom_ops_bot">wecom_ops_bot</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>Image</p>
                                                {objectChannel === 'wecom_ops_bot' ? (
                                                    <p className={`text-xs ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                                                        wecom_ops_bot does not support image fields.
                                                    </p>
                                                ) : (
                                                    <>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs ${isLight ? 'border-slate-300 text-slate-700 hover:bg-slate-100' : 'border-white/20 text-gray-200 hover:bg-white/10'}`}>
                                                                <span>Upload image</span>
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    disabled={isObjectSaving || !isBatchMetadataEditable}
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
                                                                disabled={isObjectSaving || !isBatchMetadataEditable || (!objectImageBase64 && !objectImageId)}
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
                                                    </>
                                                )}
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
                                                        setObjectName(selectedNotification.name);
                                                        setObjectChannel(selectedNotification.channel);
                                                        setObjectImageType(selectedNotification.image_type ?? null);
                                                        setObjectImageId(selectedNotification.image_id ?? null);
                                                        setObjectImageBase64(selectedNotification.image_base64 ?? null);
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
                                                    disabled={isObjectSaving || !isBatchMetadataEditable}
                                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
                                                >
                                                    {isObjectSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                                    <span>{t('edit.actions.save')}</span>
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
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

                                            <div className="space-y-2">
                                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>Image</p>
                                                {selectedNotificationImageSrc ? (
                                                    <Image
                                                        src={selectedNotificationImageSrc}
                                                        alt="Notification batch image"
                                                        width={720}
                                                        height={360}
                                                        unoptimized
                                                        className="h-auto max-h-44 w-auto rounded-md border border-white/10 object-contain"
                                                    />
                                                ) : (
                                                    <p className={`text-xs ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                                                        {selectedNotification.image_id
                                                            ? `Image uploaded with media id ${selectedNotification.image_id}`
                                                            : 'No image configured'}
                                                    </p>
                                                )}
                                                <div className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                                    <p>image_type: {selectedNotification.image_type || '—'}</p>
                                                    <p>image_id: {selectedNotification.image_id || '—'}</p>
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="grid grid-cols-2 gap-2">
                                        <select
                                            value={detailsStatusFilter}
                                            onChange={(event) => setDetailsStatusFilter(event.target.value as NotificationStatus | '')}
                                            className={`px-2 py-1.5 text-sm rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                        >
                                            <option value="">{t('details.filters.allStatus')}</option>
                                            <option value="created">created</option>
                                            <option value="sent">sent</option>
                                            <option value="failed">failed</option>
                                            <option value="cancelled">cancelled</option>
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
                                                        disabled={!canWrite || !isBatchMetadataEditable || isRowSaving || isRowDeleting}
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
                                                    disabled={!canWrite || !isBatchMetadataEditable || isRowSaving || isRowDeleting}
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
                                                disabled={rowEditorMode === 'edit' || isRowSaving || isRowDeleting || !canWrite || !isBatchMetadataEditable}
                                                className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('details.rowEditor.fields.status')}</label>
                                                <span className={`inline-block px-2 py-1 rounded-md text-xs border ${getNotificationStatusRowClass(rowStatus)}`}>
                                                    {rowStatus}
                                                </span>
                                            </div>

                                            <div>
                                                <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('details.rowEditor.fields.scheduledAt')}</label>
                                                <input
                                                    type="datetime-local"
                                                    value={rowScheduledAt}
                                                    onChange={(event) => setRowScheduledAt(event.target.value)}
                                                    disabled={isRowSaving || isRowDeleting || !canWrite || !isBatchMetadataEditable}
                                                    className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className={`block text-xs mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('details.rowEditor.fields.errorMessage')}</label>
                                            <p className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900 bg-slate-50' : 'border-white/10 bg-slate-900/80 text-white'}`}>
                                                {rowServerErrorMessage || '—'}
                                            </p>
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
                                            <p className={`text-xs mb-2 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('details.rowEditor.fields.content')}</p>
                                            <NotificationContentBlocksEditor
                                                blocks={rowContentBlocks}
                                                onChange={setRowContentBlocks}
                                                disabled={isRowSaving || isRowDeleting || !canWrite || !isBatchMetadataEditable}
                                            />
                                        </div>
                                    </section>
                                )}

                                <div className="flex flex-1 min-h-0">
                                    <div
                                        ref={notificationDetailsListRef}
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
                                                    const isSelected = detail.oid === selectedNotificationOid;
                                                    return (
                                                        <button
                                                            key={detail.oid}
                                                            type="button"
                                                            onClick={() => openEditRowEditor(detail)}
                                                            className={`w-full text-left px-4 py-3 hover:bg-white/5 ${isSelected ? 'bg-blue-500/10' : ''}`}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <p className={`text-sm font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>{detail.receiver_stable_id}</p>
                                                                <span className={`px-2 py-0.5 rounded-full text-xs border ${getNotificationStatusRowClass(detail.status)}`}>
                                                                    {detail.status}
                                                                </span>
                                                            </div>
                                                            <p className={`text-xs mt-1 whitespace-pre-wrap break-words ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
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
