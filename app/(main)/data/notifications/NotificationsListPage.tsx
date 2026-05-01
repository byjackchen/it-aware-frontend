'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { Bell, RefreshCw, Search, Loader2 } from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { QuickScrollRail } from '@/components/data/QuickScrollRail';
import type { NotificationBatch, Notification, NotificationBatchListResponse, NotificationListResponse } from '@/lib/types/objects';

const PAGE_SIZE = 1000;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    created: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
    sent: { bg: 'bg-green-500/20', text: 'text-green-500' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-500' },
    cancelled: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
};

function contentPreview(notification: Notification): string {
    for (const block of notification.content_blocks) {
        if (block.type === 'title') return block.text;
        if (block.type === 'text') return block.text;
    }
    return '—';
}

export function NotificationsListPage() {
    const { theme } = useTheme();
    const router = useTransitionRouter();
    const isLight = theme === 'light';
    const [searchQuery, setSearchQuery] = useState('');

    const [batches, setBatches] = useState<NotificationBatch[]>([]);
    const [selectedBatchOid, setSelectedBatchOid] = useState<string>('');
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [totalNotifications, setTotalNotifications] = useState<number | null>(null);
    const [isLoadingBatches, setIsLoadingBatches] = useState(true);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch batches on mount
    useEffect(() => {
        let cancelled = false;
        async function fetchBatches() {
            setIsLoadingBatches(true);
            setError(null);
            try {
                const res = await fetch('/api/campaigns/notification_batchs?limit=1000');
                if (!res.ok) throw new Error('Failed to load notification batches');
                const data: NotificationBatchListResponse = await res.json();
                if (!cancelled) {
                    setBatches(data.items || []);
                    if (data.items?.length) {
                        setSelectedBatchOid(data.items[0].oid);
                    }
                }
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                if (!cancelled) setIsLoadingBatches(false);
            }
        }
        void fetchBatches();
        return () => { cancelled = true; };
    }, []);

    // Fetch ALL notifications (paginated) when batch changes
    const fetchAllNotifications = useCallback(async (batchOid: string) => {
        if (!batchOid) {
            setNotifications([]);
            setTotalNotifications(null);
            return;
        }
        setIsLoadingNotifications(true);
        setError(null);
        setNotifications([]);
        setTotalNotifications(null);

        try {
            const allItems: Notification[] = [];
            let skip = 0;
            let total = 0;

            // eslint-disable-next-line no-constant-condition
            while (true) {
                const res = await fetch(
                    `/api/campaigns/notification_batchs/${encodeURIComponent(batchOid)}/notifications?limit=${PAGE_SIZE}&skip=${skip}`
                );
                if (!res.ok) throw new Error('Failed to load notifications');
                const data: NotificationListResponse = await res.json();
                total = data.total;
                allItems.push(...(data.items || []));
                setNotifications([...allItems]);
                setTotalNotifications(total);

                if (allItems.length >= total || (data.items?.length ?? 0) < PAGE_SIZE) {
                    break;
                }
                skip += PAGE_SIZE;
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setIsLoadingNotifications(false);
        }
    }, []);

    useEffect(() => {
        if (selectedBatchOid) {
            void fetchAllNotifications(selectedBatchOid);
        }
    }, [selectedBatchOid, fetchAllNotifications]);

    const filteredNotifications = useMemo(() => {
        if (searchQuery === '') return notifications;
        const q = searchQuery.toLowerCase();
        return notifications.filter((n) =>
            n.receiver_stable_id.toLowerCase().includes(q)
            || contentPreview(n).toLowerCase().includes(q)
        );
    }, [notifications, searchQuery]);

    const selectedBatch = batches.find(b => b.oid === selectedBatchOid);

    const handleRefresh = () => {
        if (selectedBatchOid) void fetchAllNotifications(selectedBatchOid);
    };

    return (
        <div className="h-[calc(100vh-4rem)] p-4">
            <QuickScrollRail />
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400'}`}>
                            <Bell className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>Notifications</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                {filteredNotifications.length.toLocaleString()} Shown / {notifications.length.toLocaleString()} Loaded
                                {totalNotifications !== null && ` / ${totalNotifications.toLocaleString()} Total`}
                                {selectedBatch && ` \u2022 ${selectedBatch.name}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleRefresh} className={`p-2 rounded-lg transition-colors ${isLight ? 'text-slate-500 hover:bg-slate-100' : 'text-gray-400 hover:bg-white/10'}`}>
                            <RefreshCw className={`w-5 h-5 ${isLoadingNotifications ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Batch selector + Search */}
                <div className="flex items-center gap-4 mb-4">
                    <select
                        key={isLoadingBatches ? 'loading' : 'loaded'}
                        value={selectedBatchOid}
                        onChange={(e) => setSelectedBatchOid(e.target.value)}
                        disabled={isLoadingBatches}
                        className={`px-3 py-2 rounded-lg min-w-[200px] ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-amber-500/50`}
                    >
                        {isLoadingBatches ? (
                            <option>Loading batches...</option>
                        ) : batches.length === 0 ? (
                            <option>No batches found</option>
                        ) : (
                            batches.map(b => (
                                <option key={b.oid} value={b.oid}>{b.name} ({b.status})</option>
                            ))
                        )}
                    </select>
                    <div className="relative flex-1">
                        <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by receiver or content..."
                            className={`w-full pl-10 pr-4 py-2 rounded-lg ${isLight ? 'bg-slate-100 text-slate-800' : 'bg-white/10 text-white'} focus:outline-none focus:ring-2 focus:ring-amber-500/50`}
                        />
                    </div>
                </div>

                {/* Loading progress */}
                {isLoadingNotifications && notifications.length > 0 && (
                    <div className={`mb-4 text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                        <span className="inline-flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading notifications... {notifications.length.toLocaleString()}{totalNotifications !== null && ` / ${totalNotifications.toLocaleString()}`}
                        </span>
                    </div>
                )}

                {/* List */}
                <div className={`rounded-xl border overflow-hidden ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {(isLoadingBatches || isLoadingNotifications) && notifications.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                            <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading notifications...</span>
                        </div>
                    ) : error && notifications.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-red-500' : 'text-red-400'}`}>{error}</div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className={`py-12 text-center ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No notifications found</div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {filteredNotifications.map((notification) => {
                                const statusStyle = STATUS_COLORS[notification.status] || STATUS_COLORS.created;
                                return (
                                    <button
                                        key={notification.oid}
                                        onClick={() => router.push(`/data/notifications/${notification.oid}?batch=${notification.notification_batch_oid}`)}
                                        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${isLight ? 'hover:bg-slate-50' : 'hover:bg-white/5'}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className={`font-medium truncate ${isLight ? 'text-slate-800' : 'text-white'}`}>
                                                {notification.receiver_stable_id}
                                            </div>
                                            <div className={`text-sm truncate ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                                {contentPreview(notification)}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-4 shrink-0">
                                            {notification.error_message && (
                                                <span className="text-xs text-red-500 max-w-[120px] truncate" title={notification.error_message}>
                                                    {notification.error_message}
                                                </span>
                                            )}
                                            <span className={`text-xs px-2 py-1 rounded-full capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                                                {notification.status}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
