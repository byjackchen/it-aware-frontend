'use client';

/**
 * Notification detail page client component. Read-only.
 */

import { useTransitionRouter } from '@/components/navigation/useTransitionRouter';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
    ArrowLeft,
    Bell,
    User,
    ExternalLink,
} from 'lucide-react';
import { useTheme } from '@/lib/contexts/theme-context';
import { useTimezone } from '@/lib/contexts/timezone-context';
import { formatDateTime } from '@/lib/utils/datetime';
import type { Notification, NotificationBatch, Worker, NotificationContentBlock } from '@/lib/types/objects';

interface NotificationDetailPageProps {
    notification: Notification;
    notificationBatch: NotificationBatch;
    workers: Worker[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
    created: { bg: 'bg-gray-500/20', text: 'text-gray-500' },
    sent: { bg: 'bg-green-500/20', text: 'text-green-500' },
    failed: { bg: 'bg-red-500/20', text: 'text-red-500' },
    cancelled: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
};

function ContentBlockRenderer({ block, isLight }: { block: NotificationContentBlock; isLight: boolean }) {
    switch (block.type) {
        case 'title':
            return (
                <div className={`font-semibold text-base ${isLight ? 'text-slate-800' : 'text-white'}`}>
                    {block.text}
                </div>
            );
        case 'text':
            return (
                <div className={`text-sm whitespace-pre-wrap ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                    {block.text}
                </div>
            );
        case 'link':
            return (
                <a
                    href={block.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-indigo-500 hover:text-indigo-400 underline underline-offset-4"
                >
                    {block.text}
                    <ExternalLink className="w-3 h-3" />
                </a>
            );
    }
}

export function NotificationDetailPage({ notification, notificationBatch, workers }: NotificationDetailPageProps) {
    const { theme } = useTheme();
    const { timezone } = useTimezone();
    const router = useTransitionRouter();
    const t = useTranslations('Data');
    const isLight = theme === 'light';

    const receiver = notification.receiver_oid
        ? workers.find((w) => w.oid === notification.receiver_oid)
        : null;
    const statusStyle = STATUS_COLORS[notification.status] || STATUS_COLORS.created;

    return (
        <div className="h-[calc(100vh-4rem)] p-4 overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.push('/data/notifications')} className={`p-2 rounded-lg transition-colors ${isLight ? 'hover:bg-slate-100' : 'hover:bg-white/10'}`}>
                            <ArrowLeft className={`w-5 h-5 ${isLight ? 'text-slate-500' : 'text-gray-400'}`} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLight ? 'bg-amber-100 text-amber-600' : 'bg-amber-500/20 text-amber-400'}`}>
                                <Bell className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className={`text-2xl font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('notifications.detail')}</h1>
                                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>
                                    {notification.receiver_stable_id}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium capitalize ${statusStyle.bg} ${statusStyle.text}`}>
                        {notification.status}
                    </div>
                </div>

                {/* Details Card */}
                <div className={`rounded-xl border p-6 space-y-6 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    {/* Batch */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('notifications.batch')}</label>
                        <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            {notificationBatch.name} <span className="opacity-50">({notificationBatch.status})</span>
                        </div>
                    </div>

                    {/* Channel */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('notifications.channel')}</label>
                        <div className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                            {notificationBatch.channel.replace(/_/g, ' ')}
                        </div>
                    </div>

                    {/* Receiver */}
                    <div>
                        <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('notifications.receiver')}</label>
                        <div className={`flex items-center gap-2 ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>
                            <User className={`w-4 h-4 ${isLight ? 'text-slate-400' : 'text-gray-500'}`} />
                            {receiver ? (
                                <Link href={`/data/workers/${receiver.stable_id}`} className="underline underline-offset-4">
                                    {receiver.fullname} ({notification.receiver_stable_id})
                                </Link>
                            ) : (
                                <span>{notification.receiver_stable_id}</span>
                            )}
                        </div>
                    </div>

                    {/* Error */}
                    {notification.error_message && (
                        <div>
                            <label className={`block text-sm font-medium mb-1 ${isLight ? 'text-red-500' : 'text-red-400'}`}>{t('notifications.errorMessage')}</label>
                            <div className={`text-sm p-3 rounded-lg ${isLight ? 'bg-red-50 text-red-700' : 'bg-red-500/10 text-red-300'}`}>
                                {notification.error_message}
                            </div>
                        </div>
                    )}

                    {/* Timestamps */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dashed border-slate-200 dark:border-white/10">
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Created At</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(notification.created_at, timezone)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">Updated At</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>{formatDateTime(notification.updated_at, timezone)}</span>
                        </div>
                        <div>
                            <span className="block text-xs font-semibold opacity-60 uppercase tracking-wider mb-1">{t('notifications.scheduledAt')}</span>
                            <span className={`text-sm ${isLight ? 'text-slate-700' : 'text-gray-300'}`}>
                                {notification.scheduled_at ? formatDateTime(notification.scheduled_at, timezone) : '\u2014'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Content Blocks */}
                <div className={`rounded-xl border p-6 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <h2 className={`text-lg font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>{t('notifications.content')}</h2>

                    {notification.content_blocks.length === 0 ? (
                        <div className={`text-sm italic opacity-50 ${isLight ? 'text-slate-500' : 'text-gray-500'}`}>No content blocks</div>
                    ) : (
                        <div className={`space-y-3 p-4 rounded-lg ${isLight ? 'bg-slate-50' : 'bg-white/5'}`}>
                            {notification.content_blocks.map((block, idx) => (
                                <ContentBlockRenderer key={idx} block={block} isLight={isLight} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
