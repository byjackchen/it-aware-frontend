'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from '@/lib/contexts/theme-context';
import {
    createCampaignSurveyBatchSpreadsheetImportAction,
    type SurveyBatchSpreadsheetImportRow,
} from '@/app/actions/campaigns';
import type { SurveySpreadsheetParseResult } from './types';
import { buildSurveySpreadsheetTemplateXlsx, parseSurveySpreadsheetFile } from './utils';

interface SurveyDirectSpreadsheetCreateProps {
    validStableIds: string[];
    isWorkersLoading: boolean;
    workersError: string | null;
}

const EMPTY_PARSE_RESULT: SurveySpreadsheetParseResult = {
    rows: [],
    totalRows: 0,
    validRows: 0,
    duplicateRowsIgnored: 0,
    unmatchedStableIds: [],
    rowErrors: [],
    fatalError: null,
};

export function SurveyDirectSpreadsheetCreate({
    validStableIds,
    isWorkersLoading,
    workersError,
}: SurveyDirectSpreadsheetCreateProps) {
    const t = useTranslations('CampaignSurvey');
    const { theme } = useTheme();
    const router = useRouter();
    const isLight = theme === 'light';

    const [parseResult, setParseResult] = useState<SurveySpreadsheetParseResult>(EMPTY_PARSE_RESULT);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, startSubmitting] = useTransition();

    const validStableIdSet = useMemo(() => new Set(validStableIds), [validStableIds]);
    const previewRows = useMemo(() => parseResult.rows.slice(0, 50), [parseResult.rows]);

    const canSubmit =
        !isWorkersLoading
        && !workersError
        && parseResult.fatalError === null
        && parseResult.validRows > 0;

    const handleTemplateDownload = () => {
        const bytes = buildSurveySpreadsheetTemplateXlsx();
        const normalizedBytes = Uint8Array.from(bytes);
        const blob = new Blob(
            [normalizedBytes],
            { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
        );
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'survey_import_template.xlsx';
        anchor.click();
        window.URL.revokeObjectURL(url);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setSubmitError(null);

        if (isWorkersLoading) {
            setSubmitError(t('directUpload.waitWorkers'));
            return;
        }

        if (workersError) {
            setSubmitError(workersError);
            return;
        }

        try {
            const result = await parseSurveySpreadsheetFile(file, validStableIdSet);
            setParseResult(result);
        } catch {
            setParseResult({
                ...EMPTY_PARSE_RESULT,
                fatalError: t('directUpload.parseFatal'),
            });
        }
    };

    const handleImport = () => {
        setSubmitError(null);

        if (!canSubmit) {
            if (parseResult.fatalError) {
                setSubmitError(parseResult.fatalError);
                return;
            }
            setSubmitError(t('directUpload.noValidRows'));
            return;
        }

        startSubmitting(async () => {
            const rows: SurveyBatchSpreadsheetImportRow[] = parseResult.rows.map((row) => ({
                name: row.name,
                receiver_stable_id: row.receiverStableId,
                survey_questions: row.surveyQuestions,
            }));

            const result = await createCampaignSurveyBatchSpreadsheetImportAction(rows);

            if (!result.success) {
                setSubmitError(result.error);
                return;
            }

            const firstOid = result.data.created_batch_oids[0];
            if (firstOid) {
                router.push(`/campaign/survey-batches?surveyBatch=${encodeURIComponent(firstOid)}`);
            } else {
                router.push('/campaign/survey-batches');
            }
            router.refresh();
        });
    };

    return (
        <section className={`rounded-xl border p-4 space-y-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-white/5'}`}>
            <div className="space-y-1">
                <h2 className={`text-base font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {t('directUpload.title')}
                </h2>
                <p className={`text-sm ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>
                    {t('directUpload.subtitle')}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={handleTemplateDownload}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-white/10 text-gray-200 hover:bg-white/10"
                >
                    <Download className="w-4 h-4" />
                    <span>{t('directUpload.downloadTemplate')}</span>
                </button>

                <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer ${isWorkersLoading || workersError ? 'border-white/10 text-gray-500 cursor-not-allowed' : 'border-blue-400/40 text-blue-300 hover:bg-blue-500/20'}`}>
                    <Upload className="w-4 h-4" />
                    <span>{t('directUpload.uploadFile')}</span>
                    <input
                        type="file"
                        accept=".xlsx"
                        onChange={handleFileChange}
                        disabled={isWorkersLoading || Boolean(workersError)}
                        className="hidden"
                    />
                </label>

                <button
                    type="button"
                    onClick={handleImport}
                    disabled={!canSubmit || isSubmitting}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-60"
                >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    <span>{t('directUpload.import')}</span>
                </button>
            </div>

            <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gray-400'}`}>{t('directUpload.templateHint')}</p>

            {isWorkersLoading && (
                <div className={`text-sm ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>
                    {t('receivers.loadingWorkers')}
                </div>
            )}

            {workersError && (
                <div className="rounded-md border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                    {workersError}
                </div>
            )}

            {parseResult.fatalError && (
                <div className="rounded-md border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                    {parseResult.fatalError}
                </div>
            )}

            {submitError && (
                <div className="rounded-md border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-sm text-rose-200">
                    {submitError}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
                <div className={`rounded-md border px-2 py-1.5 ${isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-300'}`}>
                    {t('directUpload.summary.totalRows')}: {parseResult.totalRows}
                </div>
                <div className={`rounded-md border px-2 py-1.5 ${isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-300'}`}>
                    {t('directUpload.summary.validRows')}: {parseResult.validRows}
                </div>
                <div className={`rounded-md border px-2 py-1.5 ${isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-300'}`}>
                    {t('directUpload.summary.unmatchedRows')}: {parseResult.unmatchedStableIds.length}
                </div>
                <div className={`rounded-md border px-2 py-1.5 ${isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-300'}`}>
                    {t('directUpload.summary.duplicateRowsIgnored')}: {parseResult.duplicateRowsIgnored}
                </div>
                <div className={`rounded-md border px-2 py-1.5 ${isLight ? 'border-slate-300 text-slate-700' : 'border-white/10 text-gray-300'}`}>
                    {t('directUpload.summary.invalidRows')}: {parseResult.rowErrors.length}
                </div>
            </div>

            {parseResult.unmatchedStableIds.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-amber-200">{t('directUpload.unmatchedTitle')}</p>
                    <p className="text-sm text-amber-100 mt-1 break-all">{parseResult.unmatchedStableIds.slice(0, 20).join(', ')}</p>
                </div>
            )}

            {parseResult.rowErrors.length > 0 && (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-2 space-y-1">
                    <p className="text-xs uppercase tracking-wide text-amber-200">{t('directUpload.rowErrorsTitle')}</p>
                    {parseResult.rowErrors.slice(0, 10).map((rowError) => (
                        <p key={`${rowError.sourceRow}-${rowError.receiverStableId}`} className="text-sm text-amber-100">
                            {t('directUpload.rowErrorLine', {
                                row: rowError.sourceRow,
                                stableId: rowError.receiverStableId,
                                message: rowError.message,
                            })}
                        </p>
                    ))}
                </div>
            )}

            {previewRows.length > 0 && (
                <div className="rounded-lg border border-white/10 overflow-hidden">
                    <div className={`px-3 py-2 border-b text-sm ${isLight ? 'border-slate-200 text-slate-700' : 'border-white/10 text-gray-200'}`}>
                        {t('directUpload.previewTitle')}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className={isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/5 text-gray-300'}>
                                <tr>
                                    <th className="text-left px-3 py-2">{t('directUpload.previewColumns.row')}</th>
                                    <th className="text-left px-3 py-2">{t('directUpload.previewColumns.name')}</th>
                                    <th className="text-left px-3 py-2">{t('directUpload.previewColumns.receiver')}</th>
                                    <th className="text-left px-3 py-2">{t('directUpload.previewColumns.questionCount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previewRows.map((row) => (
                                    <tr key={`${row.sourceRow}-${row.receiverStableId}`} className="border-t border-white/5">
                                        <td className={`px-3 py-1.5 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{row.sourceRow}</td>
                                        <td className={`px-3 py-1.5 ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{row.name}</td>
                                        <td className={`px-3 py-1.5 ${isLight ? 'text-slate-700' : 'text-gray-200'}`}>{row.receiverStableId}</td>
                                        <td className={`px-3 py-1.5 ${isLight ? 'text-slate-600' : 'text-gray-300'}`}>{row.surveyQuestions.questions.length}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
}
