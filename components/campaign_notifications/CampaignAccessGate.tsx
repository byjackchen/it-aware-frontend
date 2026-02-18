'use client';

import type { ReactNode } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePermissions } from '@/lib/contexts/user-context';
import { PERMISSIONS } from '@/lib/config/permissions';

interface CampaignAccessGateProps {
    children: ReactNode;
    requireWrite?: boolean;
}

export function CampaignAccessGate({ children, requireWrite = false }: CampaignAccessGateProps) {
    const t = useTranslations('Campaign');
    const { hasPermission } = usePermissions();

    const canNavigate = hasPermission(PERMISSIONS.UI.NAVIGATION_CAMPAIGN);
    const canRead = hasPermission(PERMISSIONS.OBJECTS.NOTIFICATIONS_READ);
    const canWrite = hasPermission(PERMISSIONS.OBJECTS.NOTIFICATIONS_WRITE);

    const hasAccess = canNavigate && canRead && (!requireWrite || canWrite);

    if (hasAccess) {
        return <>{children}</>;
    }

    return (
        <div className="h-[calc(100vh-4rem)] p-6">
            <div className="max-w-3xl mx-auto rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
                <div className="flex items-start gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-300 mt-0.5" />
                    <div>
                        <h1 className="text-lg font-semibold text-amber-100">{t('accessDenied.title')}</h1>
                        <p className="text-sm text-amber-200/90 mt-1">{t('accessDenied.description')}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
