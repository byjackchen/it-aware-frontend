/**
 * Notification detail page - Server Component.
 */

import type { ComponentProps } from 'react';
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

    // Built outside the try: React renders after this returns, so a try cannot catch its errors.
    let props: ComponentProps<typeof NotificationDetailPage>;
    try {
        const [notification, notificationBatch, workers] = await Promise.all([
            getNotification(batch, oid),
            getNotificationBatch(batch),
            getWorkers(),
        ]);

        props = { notification, notificationBatch, workers };
    } catch {
        notFound();
    }

    return <NotificationDetailPage {...props} />;
}
