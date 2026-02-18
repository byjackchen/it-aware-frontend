'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useLazyResourceList } from '@/lib/hooks/useLazyResourceList';
import {
    batchUpsertCampaignNotificationDetailsAction,
    deleteCampaignNotificationDetailAction,
    updateCampaignNotificationAction,
} from '@/app/actions/campaigns';
import type {
    Notification,
    NotificationChannel,
    NotificationContentBlock,
    NotificationDetail,
    Worker,
} from '@/lib/types/objects';
import { CampaignAccessGate } from './CampaignAccessGate';
import { NotificationContentBlocksEditor } from './NotificationContentBlocksEditor';
import { cloneContentBlocks, createEmptyBlock } from './utils';

interface NotificationEditWorkspaceProps {
    notification: Notification;
    details: NotificationDetail[];
}

interface EditableRow {
    receiver_stable_id: string;
    content_blocks: NotificationContentBlock[];
    status: NotificationDetail['status'];
    scheduled_at: string | null;
    error_message: string | null;
    isNew: boolean;
}

function hasInvalidContentBlocks(blocks: NotificationContentBlock[]): boolean {
    return blocks.some((block) => {
        if (block.text.trim().length === 0) return true;
        if (block.type === 'link' && block.url.trim().length === 0) return true;
        return false;
    });
}

export function NotificationEditWorkspace({ notification, details }: NotificationEditWorkspaceProps) {
    const t = useTranslations('Campaign');
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';

    const [isPending, startTransition] = useTransition();

    const [name, setName] = useState(notification.name);
    const [channel, setChannel] = useState<NotificationChannel>(notification.channel);
    const [rows, setRows] = useState<EditableRow[]>(
        details.map((detail) => ({
            receiver_stable_id: detail.receiver_stable_id,
            content_blocks: cloneContentBlocks(detail.content_blocks),
            status: detail.status,
            scheduled_at: detail.scheduled_at,
            error_message: detail.error_message,
            isNew: false,
        }))
    );
    const [removedExistingStableIds, setRemovedExistingStableIds] = useState<string[]>([]);
    const [newReceiverStableId, setNewReceiverStableId] = useState('');
    const [copySourceStableId, setCopySourceStableId] = useState(details[0]?.receiver_stable_id ?? '');
    const [error, setError] = useState<string | null>(null);

    const {
        items: workers,
        isLoading: isWorkersLoading,
    } = useLazyResourceList<Worker>('workers', {
        auto: true,
        query: { limit: 1000, is_active: true },
    });

    const isEditable = notification.status === 'created';

    const initialStableIdSet = useMemo(
        () => new Set(details.map((detail) => detail.receiver_stable_id)),
        [details]
    );

    const workerStableIdSet = useMemo(
        () => new Set(workers.map((worker) => worker.stable_id)),
        [workers]
    );

    const handleUpdateContentBlocks = (receiverStableId: string, next: NotificationContentBlock[]) => {
        setRows((current) => current.map((row) => {
            if (row.receiver_stable_id !== receiverStableId) return row;
            return {
                ...row,
                content_blocks: next,
            };
        }));
    };

    const handleRemoveReceiver = (receiverStableId: string) => {
        setRows((current) => current.filter((row) => row.receiver_stable_id !== receiverStableId));
        if (initialStableIdSet.has(receiverStableId)) {
            setRemovedExistingStableIds((current) => {
                if (current.includes(receiverStableId)) return current;
                return [...current, receiverStableId];
            });
        }
    };

    const handleAddReceiver = () => {
        const stableId = newReceiverStableId.trim();
        if (!stableId) return;
        if (rows.some((row) => row.receiver_stable_id === stableId)) {
            setError(t('edit.errors.duplicateReceiver'));
            return;
        }

        if (workers.length > 0 && !workerStableIdSet.has(stableId)) {
            setError(t('edit.errors.receiverNotFound'));
            return;
        }

        const sourceRow = rows.find((row) => row.receiver_stable_id === copySourceStableId) ?? rows[0];
        const sourceBlocks = sourceRow ? cloneContentBlocks(sourceRow.content_blocks) : [createEmptyBlock('text')];

        setRows((current) => [
            ...current,
            {
                receiver_stable_id: stableId,
                content_blocks: sourceBlocks,
                status: 'created',
                scheduled_at: null,
                error_message: null,
                isNew: true,
            },
        ]);
        setNewReceiverStableId('');
        setError(null);
    };

    const handleSave = () => {
        setError(null);

        if (!isEditable) {
            setError(t('edit.errors.notEditable'));
            return;
        }

        if (name.trim().length === 0) {
            setError(t('edit.errors.emptyName'));
            return;
        }

        if (rows.length === 0) {
            setError(t('edit.errors.noReceivers'));
            return;
        }

        if (rows.some((row) => hasInvalidContentBlocks(row.content_blocks))) {
            setError(t('edit.errors.invalidContent'));
            return;
        }

        startTransition(async () => {
            const updated = await updateCampaignNotificationAction(notification.oid, {
                name: name.trim(),
                channel,
            });
            if (!updated.success) {
                setError(updated.error);
                return;
            }

            for (const receiverStableId of removedExistingStableIds) {
                const deleted = await deleteCampaignNotificationDetailAction(notification.oid, receiverStableId);
                if (!deleted.success) {
                    setError(deleted.error);
                    return;
                }
            }

            const upsertResult = await batchUpsertCampaignNotificationDetailsAction(
                notification.oid,
                rows.map((row) => ({
                    receiver_stable_id: row.receiver_stable_id,
                    content_blocks: cloneContentBlocks(row.content_blocks),
                    status: row.status,
                    scheduled_at: row.scheduled_at,
                    error_message: row.error_message,
                }))
            );

            if (!upsertResult.success) {
                setError(upsertResult.error);
                return;
            }

            router.push(`/campaign/notifications?notification=${encodeURIComponent(notification.oid)}`);
            router.refresh();
        });
    };

    return (
        <CampaignAccessGate requireWrite>
            <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
                <div className="max-w-6xl mx-auto space-y-4">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.push(`/campaign/notifications?notification=${encodeURIComponent(notification.oid)}`)}
                            className={`p-2 rounded-lg ${isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-gray-300'}`}
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <div>
                            <h1 className={`text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t('edit.title')}</h1>
                            <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{notification.oid}</p>
                        </div>
                    </div>

                    {!isEditable && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-4 py-3 text-sm text-amber-100">
                            {t('edit.readOnlyStatus', { status: notification.status })}
                        </div>
                    )}

                    {error && (
                        <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
                            {error}
                        </div>
                    )}

                    <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={`block text-sm mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('edit.fields.name')}</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    disabled={!isEditable || isPending}
                                    className={`w-full px-3 py-2 rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                />
                            </div>

                            <div>
                                <label className={`block text-sm mb-1 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{t('edit.fields.channel')}</label>
                                <select
                                    value={channel}
                                    onChange={(event) => setChannel(event.target.value as NotificationChannel)}
                                    disabled={!isEditable || isPending}
                                    className={`w-full px-3 py-2 rounded-md border ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                >
                                    <option value="wecom_bot">wecom_bot</option>
                                    <option value="wecom_ops_bot">wecom_ops_bot</option>
                                </select>
                            </div>
                        </div>

                        <div className="rounded-lg border border-white/10 p-3 space-y-3">
                            <p className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-gray-100'}`}>{t('edit.addReceiverTitle')}</p>
                            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_auto] gap-2 items-end">
                                <div>
                                    <label className={`block text-xs mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('edit.fields.newReceiverStableId')}</label>
                                    <input
                                        type="text"
                                        value={newReceiverStableId}
                                        onChange={(event) => setNewReceiverStableId(event.target.value)}
                                        disabled={!isEditable || isPending}
                                        className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                    />
                                </div>
                                <div>
                                    <label className={`block text-xs mb-1 ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('edit.fields.copySource')}</label>
                                    <select
                                        value={copySourceStableId}
                                        onChange={(event) => setCopySourceStableId(event.target.value)}
                                        disabled={!isEditable || isPending || rows.length === 0}
                                        className={`w-full px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                    >
                                        {rows.map((row) => (
                                            <option key={row.receiver_stable_id} value={row.receiver_stable_id}>
                                                {row.receiver_stable_id}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAddReceiver}
                                    disabled={!isEditable || isPending || isWorkersLoading}
                                    className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20 disabled:opacity-50"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>{t('edit.actions.addReceiver')}</span>
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {rows.map((row) => (
                                <div key={row.receiver_stable_id} className="rounded-lg border border-white/10 p-3 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <p className={`text-sm font-medium ${isLight ? 'text-slate-800' : 'text-white'}`}>{row.receiver_stable_id}</p>
                                        {row.isNew && (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-400/40 text-emerald-300">
                                                {t('edit.newReceiver')}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveReceiver(row.receiver_stable_id)}
                                            disabled={!isEditable || isPending}
                                            className="ml-auto p-1.5 rounded-md text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <NotificationContentBlocksEditor
                                        blocks={row.content_blocks}
                                        onChange={(next) => handleUpdateContentBlocks(row.receiver_stable_id, next)}
                                        disabled={!isEditable || isPending}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={!isEditable || isPending}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                <span>{t('edit.actions.save')}</span>
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </CampaignAccessGate>
    );
}
