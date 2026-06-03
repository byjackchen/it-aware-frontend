'use client';

/**
 * Thin wrapper around AutoRefreshControl that pulls its labels from
 * the `OpsDashboard.autoRefresh` i18n namespace — so every ops dashboard
 * can drop it in with just a `storageKey` and `onRefresh`.
 */

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { AutoRefreshControl, type AutoRefreshOption } from './AutoRefreshControl';

export interface TranslatedAutoRefreshProps {
    onRefresh: () => void | Promise<void>;
    storageKey: string;
    /** Initial interval in ms (used only when nothing is persisted). */
    defaultValue?: number;
}

export function TranslatedAutoRefresh({
    onRefresh,
    storageKey,
    defaultValue = 0,
}: TranslatedAutoRefreshProps) {
    const t = useTranslations('OpsDashboard.autoRefresh');

    const options = useMemo<AutoRefreshOption[]>(
        () => [
            { label: t('off'), short: t('offShort'), value: 0 },
            { label: t('m5'), short: t('m5Short'), value: 5 * 60 * 1000 },
            { label: t('m10'), short: t('m10Short'), value: 10 * 60 * 1000 },
            { label: t('m15'), short: t('m15Short'), value: 15 * 60 * 1000 },
            { label: t('m30'), short: t('m30Short'), value: 30 * 60 * 1000 },
            { label: t('h1'), short: t('h1Short'), value: 60 * 60 * 1000 },
        ],
        [t],
    );

    return (
        <AutoRefreshControl
            onRefresh={onRefresh}
            storageKey={storageKey}
            label={t('label')}
            offLabel={t('off')}
            options={options}
            defaultValue={defaultValue}
        />
    );
}
