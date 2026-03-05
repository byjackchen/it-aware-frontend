/**
 * Notification detail page - Server Component.
 */

import { notFound } from 'next/navigation';
import { getNotification, getNotificationBatch } from '@/lib/api/campaigns';
import { getWorkers } from '@/lib/api/objects';
import { NotificationDetailPage } from './NotificationDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
    searchParams: Promise<{ batch?: string }>;
}

export default async function NotificationPage({ params, searchParams }: PageProps) {
    const { oid } = await params;
    const { batch } = await searchParams;

    if (!batch) {
        notFound();
    }

    try {
        const [notification, notificationBatch, workers] = await Promise.all([
            getNotification(batch, oid),
            getNotificationBatch(batch),
            getWorkers(),
        ]);

        return (
            <NotificationDetailPage
                notification={notification}
                notificationBatch={notificationBatch}
                workers={workers}
            />
        );
    } catch {
        notFound();
    }
}
