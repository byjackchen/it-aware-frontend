/**
 * Hardware detail page - Server Component.
 */

import { notFound, redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { getHardware } from '@/lib/api/objects';
import { HardwareDetailPage } from './HardwareDetailPage';

interface PageProps {
    params: Promise<{ oid: string }>;
}

export default async function HardwarePage({ params }: PageProps) {
    const { oid } = await params;

    let hardware: Awaited<ReturnType<typeof getHardware>>;
    try {
        hardware = await getHardware(oid);
    } catch (error) {
        if (error instanceof ApiError && error.status === 403) {
            redirect('/access-denied');
        }
        notFound();
    }

    return <HardwareDetailPage hardware={hardware} />;
}
