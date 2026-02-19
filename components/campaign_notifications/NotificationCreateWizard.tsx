'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { createCampaignNotificationBatchAction } from '@/app/actions/campaigns';
import type {
    NotificationBatchChannel,
    NotificationContentBlock,
    NotificationCreate,
} from '@/lib/types/objects';
import { CampaignReceiverSelector } from '@/components/campaign_shared/CampaignReceiverSelector';
import { NotificationContentBlocksEditor } from './NotificationContentBlocksEditor';
import { NotificationDirectSpreadsheetCreate } from './NotificationDirectSpreadsheetCreate';
import { upsertNotificationsInBatches, type NotificationBatchWriteProgress } from './detailBatchWriter';
import { cloneContentBlocks, createEmptyBlock } from './utils';
import type { CreateEntryMode } from './types';
import { useAllActiveWorkers } from './useAllActiveWorkers';

function hasInvalidContentBlocks(blocks: NotificationContentBlock[]): boolean {
    return blocks.some((block) => {
        if (block.text.trim().length === 0) return true;
        if (block.type === 'link' && block.url.trim().length === 0) return true;
        return false;
    });
}

export function NotificationCreateWizard() {
    const t = useTranslations('Campaign');
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';

    const [isPending, startTransition] = useTransition();
    const [createMode, setCreateMode] = useState<CreateEntryMode>('guided');
    const [name, setName] = useState('');
    const [channel, setChannel] = useState<NotificationBatchChannel>('wecom_bot');
    const [contentBlocks, setContentBlocks] = useState<NotificationContentBlock[]>([createEmptyBlock('text')]);
    const [selectedReceiverStableIds, setSelectedReceiverStableIds] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [batchProgress, setBatchProgress] = useState<NotificationBatchWriteProgress | null>(null);

    const {
        workers,
        isLoading: isWorkersLoading,
        error: workersError,
    } = useAllActiveWorkers();

    const workerStableIdSet = useMemo(() => new Set(workers.map((worker) => worker.stable_id)), [workers]);

    const handleGuidedSubmit = () => {
        setError(null);
        setBatchProgress(null);

        if (name.trim().length === 0) {
            setError(t('create.errors.emptyName'));
            return;
        }

        if (contentBlocks.length === 0 || hasInvalidContentBlocks(contentBlocks)) {
            setError(t('create.errors.invalidContent'));
            return;
        }

        if (selectedReceiverStableIds.length === 0) {
            setError(t('create.errors.noReceivers'));
            return;
        }

        startTransition(async () => {
            const createResult = await createCampaignNotificationBatchAction({
                name: name.trim(),
                channel,
            });

            if (!createResult.success) {
                setError(createResult.error);
                return;
            }

            const notificationBatchOid = createResult.data.oid;
            const notifications: NotificationCreate[] = selectedReceiverStableIds.map((stableId) => ({
                receiver_stable_id: stableId,
                content_blocks: cloneContentBlocks(contentBlocks),
                status: 'created',
            }));

            const upsertResult = await upsertNotificationsInBatches(notificationBatchOid, notifications, setBatchProgress);
            if (!upsertResult.success) {
                setError(t('create.errors.partialWrite', {
                    notificationBatchOid,
                    processed: upsertResult.processedRows,
                    total: upsertResult.totalRows,
                    error: upsertResult.error,
                }));
                return;
            }

            router.push(`/campaign/notification-batches?notificationBatch=${encodeURIComponent(notificationBatchOid)}`);
            router.refresh();
        });
    };

    return (
        <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push('/campaign/notification-batches')}
                        className={`p-2 rounded-lg ${isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-gray-300'}`}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className={`text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t('create.title')}</h1>
                        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('create.subtitle')}</p>
                    </div>
                </div>

                <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setCreateMode('guided');
                                setSelectedReceiverStableIds([]);
                                setError(null);
                                setBatchProgress(null);
                            }}
                            className={`px-3 py-1.5 rounded-md border text-sm ${createMode === 'guided' ? 'border-blue-400 bg-blue-500/20 text-blue-200' : isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-300'}`}
                        >
                            {t('create.entryModes.guided')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCreateMode('excel_direct');
                                setSelectedReceiverStableIds([]);
                                setError(null);
                                setBatchProgress(null);
                            }}
                            className={`px-3 py-1.5 rounded-md border text-sm ${createMode === 'excel_direct' ? 'border-blue-400 bg-blue-500/20 text-blue-200' : isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-300'}`}
                        >
                            {t('create.entryModes.excelDirect')}
                        </button>
                    </div>
                </section>

                {createMode === 'excel_direct' && (
                    <NotificationDirectSpreadsheetCreate
                        validStableIds={Array.from(workerStableIdSet)}
                        isWorkersLoading={isWorkersLoading}
                        workersError={workersError}
                    />
                )}

                {createMode === 'guided' && (
                    <>
                        {error && (
                            <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
                                {error}
                            </div>
                        )}

                        <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                            <h2 className={`text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t('create.steps.content')}</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={`block text-sm mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('create.fields.name')}</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(event) => setName(event.target.value)}
                                        placeholder={t('create.fields.namePlaceholder')}
                                        className={`w-full px-3 py-2 rounded-md border ${isLight ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-sm mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('create.fields.channel')}</label>
                                    <select
                                        value={channel}
                                        onChange={(event) => setChannel(event.target.value as NotificationBatchChannel)}
                                        className={`w-full px-3 py-2 rounded-md border ${isLight ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                    >
                                        <option value="wecom_bot">wecom_bot</option>
                                        <option value="wecom_ops_bot">wecom_ops_bot</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={`block text-sm mb-2 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('create.fields.contentBlocks')}</label>
                                <NotificationContentBlocksEditor blocks={contentBlocks} onChange={setContentBlocks} />
                            </div>
                        </section>

                        <CampaignReceiverSelector
                            namespace="Campaign"
                            sectionTitle={t('create.steps.receivers')}
                            isLight={isLight}
                            workers={workers}
                            isWorkersLoading={isWorkersLoading}
                            workersError={workersError}
                            onSelectionChange={setSelectedReceiverStableIds}
                            onErrorChange={setError}
                        />

                        <div className="flex items-center justify-end gap-3">
                            {batchProgress && isPending && (
                                <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                                    {t('batchProgress', {
                                        processed: batchProgress.processedRows,
                                        total: batchProgress.totalRows,
                                        currentBatch: batchProgress.currentBatch,
                                        totalBatches: batchProgress.totalBatches,
                                    })}
                                </p>
                            )}
                            <button
                                type="button"
                                onClick={handleGuidedSubmit}
                                disabled={isPending}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                            >
                                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>{t('create.actions.create')}</span>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
