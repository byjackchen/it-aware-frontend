'use client';

import { Download, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { buildReceiverTemplateCsv, parseReceiverSpreadsheet } from './utils';

interface ReceiverSpreadsheetUploadProps {
    validStableIds: string[];
    selectedStableIds: string[];
    onSelectedStableIdsChange: (stableIds: string[]) => void;
}

export function ReceiverSpreadsheetUpload({
    validStableIds,
    selectedStableIds,
    onSelectedStableIdsChange,
}: ReceiverSpreadsheetUploadProps) {
    const t = useTranslations('Campaign');
    const [error, setError] = useState<string | null>(null);
    const [unmatchedStableIds, setUnmatchedStableIds] = useState<string[]>([]);
    const [processedRows, setProcessedRows] = useState<number>(0);

    const validStableIdSet = useMemo(() => new Set(validStableIds), [validStableIds]);

    const handleTemplateDownload = () => {
        const blob = new Blob([buildReceiverTemplateCsv()], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'notification_receivers_template.csv';
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setError(null);
        try {
            const text = await file.text();
            const result = parseReceiverSpreadsheet(text, validStableIdSet);
            setProcessedRows(result.totalRows);
            setUnmatchedStableIds(result.unmatchedStableIds);

            if (result.error) {
                setError(result.error);
                onSelectedStableIdsChange([]);
                return;
            }

            onSelectedStableIdsChange(result.matchedStableIds);
        } catch {
            setError(t('receivers.uploadReadError'));
            onSelectedStableIdsChange([]);
        }
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleTemplateDownload}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-white/10 text-gray-200 hover:bg-white/10"
                >
                    <Download className="w-4 h-4" />
                    <span>{t('receivers.downloadTemplate')}</span>
                </button>

                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-blue-400/40 text-blue-300 hover:bg-blue-500/20 cursor-pointer">
                    <Upload className="w-4 h-4" />
                    <span>{t('receivers.uploadFile')}</span>
                    <input
                        type="file"
                        accept=".csv,.txt,.tsv"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                </label>
            </div>

            {error && (
                <div className="rounded-md border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                    {error}
                </div>
            )}

            <div className="text-sm text-gray-300">
                {t('receivers.uploadSummary', {
                    matched: selectedStableIds.length,
                    total: processedRows,
                    unmatched: unmatchedStableIds.length,
                })}
            </div>

            {unmatchedStableIds.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-amber-200">{t('receivers.unmatched')}</p>
                    <p className="text-sm text-amber-100 mt-1 break-all">{unmatchedStableIds.slice(0, 12).join(', ')}</p>
                </div>
            )}
        </div>
    );
}
