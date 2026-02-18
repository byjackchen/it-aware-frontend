'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import { useLazyResourceList } from '@/lib/hooks/useLazyResourceList';
import { createCampaignNotificationAction } from '@/app/actions/campaigns';
import type {
    Location,
    NotificationChannel,
    NotificationContentBlock,
    Organization,
    Worker,
} from '@/lib/types/objects';
import { NotificationContentBlocksEditor } from './NotificationContentBlocksEditor';
import { ReceiverSpreadsheetUpload } from './ReceiverSpreadsheetUpload';
import { cloneContentBlocks, createEmptyBlock } from './utils';
import type { ReceiverMode } from './types';

function toggleSelection(current: string[], value: string): string[] {
    if (current.includes(value)) {
        return current.filter((item) => item !== value);
    }
    return [...current, value];
}

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
    const [step, setStep] = useState<1 | 2>(1);
    const [name, setName] = useState('');
    const [channel, setChannel] = useState<NotificationChannel>('wecom_bot');
    const [contentBlocks, setContentBlocks] = useState<NotificationContentBlock[]>([createEmptyBlock('text')]);
    const [mode, setMode] = useState<ReceiverMode>('dimensions');
    const [error, setError] = useState<string | null>(null);

    const [selectedOrganizationOids, setSelectedOrganizationOids] = useState<string[]>([]);
    const [selectedLocationOids, setSelectedLocationOids] = useState<string[]>([]);
    const [selectedWorkerTypes, setSelectedWorkerTypes] = useState<string[]>([]);
    const [manuallyDeselectedStableIds, setManuallyDeselectedStableIds] = useState<string[]>([]);
    const [manuallyAddedStableIds, setManuallyAddedStableIds] = useState<string[]>([]);
    const [spreadsheetStableIds, setSpreadsheetStableIds] = useState<string[]>([]);
    const [manualStableId, setManualStableId] = useState('');

    const {
        items: workers,
        isLoading: isWorkersLoading,
        error: workersError,
    } = useLazyResourceList<Worker>('workers', {
        auto: true,
        query: { limit: 1000, is_active: true },
    });

    const { items: organizations } = useLazyResourceList<Organization>('organizations', {
        auto: true,
        query: { limit: 1000, is_active: true },
    });

    const { items: locations } = useLazyResourceList<Location>('locations', {
        auto: true,
        query: { limit: 1000, is_active: true },
    });

    const workerStableIdSet = useMemo(() => new Set(workers.map((worker) => worker.stable_id)), [workers]);

    const workerTypeOptions = useMemo(
        () => Array.from(new Set(workers.map((worker) => worker.worker_type).filter((type): type is string => Boolean(type)))).sort(),
        [workers]
    );

    const filteredWorkers = useMemo(() => {
        return workers.filter((worker) => {
            const orgMatch = selectedOrganizationOids.length === 0 || selectedOrganizationOids.includes(worker.org_oid);
            const locationMatch =
                selectedLocationOids.length === 0
                    ? true
                    : (worker.location_oid !== null && selectedLocationOids.includes(worker.location_oid));
            const workerTypeMatch =
                selectedWorkerTypes.length === 0
                    ? true
                    : (worker.worker_type !== null && selectedWorkerTypes.includes(worker.worker_type));

            return orgMatch && locationMatch && workerTypeMatch;
        });
    }, [workers, selectedLocationOids, selectedOrganizationOids, selectedWorkerTypes]);

    const autoSelectedStableIds = useMemo(
        () => filteredWorkers.map((worker) => worker.stable_id),
        [filteredWorkers]
    );

    const selectedStableIdsByDimensions = useMemo(() => {
        const selected = new Set<string>();

        autoSelectedStableIds.forEach((stableId) => {
            if (!manuallyDeselectedStableIds.includes(stableId)) {
                selected.add(stableId);
            }
        });

        manuallyAddedStableIds.forEach((stableId) => {
            if (workerStableIdSet.has(stableId)) {
                selected.add(stableId);
            }
        });

        return Array.from(selected).sort((a, b) => a.localeCompare(b));
    }, [autoSelectedStableIds, manuallyAddedStableIds, manuallyDeselectedStableIds, workerStableIdSet]);

    const manuallyAddedOnlyStableIds = useMemo(
        () => selectedStableIdsByDimensions.filter((stableId) => !autoSelectedStableIds.includes(stableId)),
        [autoSelectedStableIds, selectedStableIdsByDimensions]
    );

    const finalStableIds = mode === 'spreadsheet' ? spreadsheetStableIds : selectedStableIdsByDimensions;

    const canContinueStepOne =
        name.trim().length > 0 &&
        contentBlocks.length > 0 &&
        !hasInvalidContentBlocks(contentBlocks);

    const handleSubmit = () => {
        setError(null);

        if (finalStableIds.length === 0) {
            setError(t('create.errors.noReceivers'));
            return;
        }

        if (!canContinueStepOne) {
            setError(t('create.errors.invalidContent'));
            return;
        }

        startTransition(async () => {
            const result = await createCampaignNotificationAction({
                name: name.trim(),
                channel,
                details: finalStableIds.map((stableId) => ({
                    receiver_stable_id: stableId,
                    content_blocks: cloneContentBlocks(contentBlocks),
                    status: 'created',
                })),
            });

            if (!result.success) {
                setError(result.error);
                return;
            }

            router.push(`/campaign/notifications?notification=${encodeURIComponent(result.data.oid)}`);
            router.refresh();
        });
    };

    const handleManualAdd = () => {
        const stableId = manualStableId.trim();
        if (!stableId) return;
        if (!workerStableIdSet.has(stableId)) {
            setError(t('create.errors.receiverNotFound'));
            return;
        }

        if (autoSelectedStableIds.includes(stableId)) {
            setManuallyDeselectedStableIds((current) => current.filter((item) => item !== stableId));
        } else {
            setManuallyAddedStableIds((current) => {
                if (current.includes(stableId)) return current;
                return [...current, stableId].sort((a, b) => a.localeCompare(b));
            });
        }

        setManualStableId('');
        setError(null);
    };

    return (
        <div className="h-[calc(100vh-4rem)] overflow-y-auto p-4">
            <div className="max-w-6xl mx-auto space-y-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push('/campaign/notifications')}
                        className={`p-2 rounded-lg ${isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-gray-300'}`}
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className={`text-xl font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{t('create.title')}</h1>
                        <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('create.subtitle')}</p>
                    </div>
                </div>

                <div className={`rounded-xl border p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-full border text-xs flex items-center justify-center ${step === 1 ? 'border-blue-400 text-blue-300' : 'border-emerald-400 text-emerald-300'}`}>
                            {step === 1 ? '1' : <Check className="w-3.5 h-3.5" />}
                        </div>
                        <span className={`text-sm ${step === 1 ? 'text-blue-300' : isLight ? 'text-slate-700' : 'text-gray-300'}`}>{t('create.steps.content')}</span>
                        <div className="h-px flex-1 bg-white/10" />
                        <div className={`w-6 h-6 rounded-full border text-xs flex items-center justify-center ${step === 2 ? 'border-blue-400 text-blue-300' : 'border-slate-500 text-slate-400'}`}>
                            2
                        </div>
                        <span className={`text-sm ${step === 2 ? 'text-blue-300' : isLight ? 'text-slate-700' : 'text-gray-300'}`}>{t('create.steps.receivers')}</span>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">
                        {error}
                    </div>
                )}

                {step === 1 && (
                    <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
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
                                    onChange={(event) => setChannel(event.target.value as NotificationChannel)}
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

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setStep(2)}
                                disabled={!canContinueStepOne}
                                className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                            >
                                {t('create.actions.next')}
                            </button>
                        </div>
                    </section>
                )}

                {step === 2 && (
                    <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setMode('dimensions')}
                                className={`px-3 py-1.5 rounded-md border text-sm ${mode === 'dimensions' ? 'border-blue-400 bg-blue-500/20 text-blue-200' : isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-300'}`}
                            >
                                {t('receivers.modeDimensions')}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMode('spreadsheet')}
                                className={`px-3 py-1.5 rounded-md border text-sm ${mode === 'spreadsheet' ? 'border-blue-400 bg-blue-500/20 text-blue-200' : isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-300'}`}
                            >
                                {t('receivers.modeSpreadsheet')}
                            </button>
                        </div>

                        {mode === 'dimensions' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <p className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{t('receivers.filters.organization')}</p>
                                        <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-2">
                                            {organizations.map((organization) => (
                                                <label key={organization.oid} className="flex items-center gap-2 text-sm text-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedOrganizationOids.includes(organization.oid)}
                                                        onChange={() => setSelectedOrganizationOids((current) => toggleSelection(current, organization.oid))}
                                                    />
                                                    <span>{organization.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{t('receivers.filters.location')}</p>
                                        <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-2">
                                            {locations.map((location) => (
                                                <label key={location.oid} className="flex items-center gap-2 text-sm text-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedLocationOids.includes(location.oid)}
                                                        onChange={() => setSelectedLocationOids((current) => toggleSelection(current, location.oid))}
                                                    />
                                                    <span>{location.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <p className={`text-sm font-medium ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{t('receivers.filters.workerType')}</p>
                                        <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-white/10 p-2">
                                            {workerTypeOptions.map((workerType) => (
                                                <label key={workerType} className="flex items-center gap-2 text-sm text-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedWorkerTypes.includes(workerType)}
                                                        onChange={() => setSelectedWorkerTypes((current) => toggleSelection(current, workerType))}
                                                    />
                                                    <span>{workerType}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-lg border border-white/10 p-3 space-y-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm text-gray-200">
                                            {t('receivers.autoSelectedCount', {
                                                count: selectedStableIdsByDimensions.length,
                                            })}
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={manualStableId}
                                                onChange={(event) => setManualStableId(event.target.value)}
                                                placeholder={t('receivers.manualAddPlaceholder')}
                                                className={`px-2 py-1.5 rounded-md border text-sm ${isLight ? 'border-slate-300 text-slate-900' : 'border-white/10 bg-slate-900/80 text-white'}`}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleManualAdd}
                                                className="px-3 py-1.5 text-sm rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20"
                                            >
                                                {t('receivers.manualAdd')}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="max-h-56 overflow-y-auto space-y-1">
                                        {filteredWorkers.map((worker) => {
                                            const checked = selectedStableIdsByDimensions.includes(worker.stable_id);
                                            return (
                                                <label key={worker.oid} className="flex items-center gap-2 text-sm text-gray-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => {
                                                            if (checked) {
                                                                setManuallyAddedStableIds((current) => current.filter((item) => item !== worker.stable_id));
                                                                setManuallyDeselectedStableIds((current) => {
                                                                    if (current.includes(worker.stable_id)) return current;
                                                                    return [...current, worker.stable_id];
                                                                });
                                                            } else {
                                                                setManuallyDeselectedStableIds((current) => current.filter((item) => item !== worker.stable_id));
                                                            }
                                                        }}
                                                    />
                                                    <span>{worker.fullname}</span>
                                                    <span className="text-xs text-gray-500">{worker.stable_id}</span>
                                                </label>
                                            );
                                        })}
                                    </div>

                                    {manuallyAddedOnlyStableIds.length > 0 && (
                                        <div className="pt-2 border-t border-white/10">
                                            <p className="text-xs text-gray-400 mb-2">{t('receivers.manualAdded')}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {manuallyAddedOnlyStableIds.map((stableId) => (
                                                    <button
                                                        key={stableId}
                                                        type="button"
                                                        onClick={() => setManuallyAddedStableIds((current) => current.filter((item) => item !== stableId))}
                                                        className="px-2 py-1 rounded-full border border-white/20 text-xs text-gray-200 hover:bg-white/10"
                                                    >
                                                        {stableId} ×
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {mode === 'spreadsheet' && (
                            <ReceiverSpreadsheetUpload
                                validStableIds={Array.from(workerStableIdSet)}
                                selectedStableIds={spreadsheetStableIds}
                                onSelectedStableIdsChange={setSpreadsheetStableIds}
                            />
                        )}

                        {(isWorkersLoading || workersError) && (
                            <div className="text-sm text-gray-300">
                                {isWorkersLoading ? t('receivers.loadingWorkers') : workersError}
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setStep(1)}
                                className={`px-4 py-2 rounded-md border ${isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-200'}`}
                            >
                                {t('create.actions.back')}
                            </button>

                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isPending}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
                            >
                                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>{t('create.actions.create')}</span>
                            </button>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
