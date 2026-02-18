import { notFound } from 'next/navigation';
import { NotificationEditWorkspace } from '@/components/campaign_notifications';
import { getNotification, getNotificationDetails } from '@/lib/api/campaigns';
import type { Notification, NotificationDetail } from '@/lib/types/objects';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function CampaignNotificationEditPage({ params }: PageProps) {
    const { oid } = await params;

    let notification: Notification;
    let details: NotificationDetail[];

    try {
        const [notificationPayload, detailsPayload] = await Promise.all([
            getNotification(oid),
            getNotificationDetails(oid, { limit: 1000, skip: 0 }),
        ]);

        notification = notificationPayload;
        details = detailsPayload.items;
    } catch {
        notFound();
    }

    return <NotificationEditWorkspace notification={notification} details={details} />;
}
