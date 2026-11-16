'use client';

/**
 * Chunked, yield-aware XLSX builder for the surveys list.
 *
 * The previous inline implementation in SurveysListPage.tsx ran a sync
 * map-of-maps over up to ~1000 surveys × ~50 questions on the main thread.
 * This blocked clicks and made the page feel frozen. This module:
 *   - processes rows in chunks of CHUNK_SIZE
 *   - awaits a frame between chunks so the browser repaints the progress UI
 *   - calls an onProgress callback so the caller can render an OverlaySpinner
 *   - indexes answers by question_id once per row (was N find() calls per row)
 */

import type { Survey } from '@/lib/types/objects';
import { downloadXlsx } from '@/lib/utils/export-xlsx';

type WorkerGeo = { country: string | null; region: string | null; location: string | null };

interface ExportInputs {
    surveys: Survey[];
    batchName: string;
    workerGeoMap: Map<string, WorkerGeo>;
    onProgress?: (pct: number) => void;
    signal?: AbortSignal;
}

const CHUNK_SIZE = 50;

function nextFrame(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
        else setTimeout(resolve, 0);
    });
}

function resolveAnswerText(
    question: Survey['survey_questions']['questions'][number],
    answer: NonNullable<Survey['survey_answer']>['answers'][number] | undefined,
): string {
    if (!answer) return '';
    if (answer.type === 'single_select') {
        if (question.type === 'single_select' || question.type === 'multi_select') {
            const opt = question.options.find((o) => o.option_id === answer.selected_option_id);
            return opt?.label ?? answer.selected_option_id;
        }
        return answer.selected_option_id;
    }
    if (answer.type === 'multi_select') {
        if (question.type === 'single_select' || question.type === 'multi_select') {
            return answer.selected_option_ids
                .map((id) => question.options.find((o) => o.option_id === id)?.label ?? id)
                .join(', ');
        }
        return answer.selected_option_ids.join(', ');
    }
    if (answer.type === 'text') return answer.text;
    return '';
}

export async function exportSurveysXlsx({
    surveys,
    batchName,
    workerGeoMap,
    onProgress,
    signal,
}: ExportInputs): Promise<void> {
    if (surveys.length === 0) return;

    const maxQuestionCount = surveys.reduce(
        (max, s) => Math.max(max, s.survey_questions?.questions?.length ?? 0),
        0,
    );

    const headers: string[] = [
        'Receiver Stable ID', 'Country', 'Region', 'Location',
        'Status', 'Submitted At', 'Created At', 'Updated At',
    ];
    for (let i = 1; i <= maxQuestionCount; i++) {
        headers.push(`Question ${i}`, `Answer ${i}`);
    }

    const rows: string[][] = [];

    for (let i = 0; i < surveys.length; i += CHUNK_SIZE) {
        if (signal?.aborted) return;
        const chunk = surveys.slice(i, i + CHUNK_SIZE);

        for (const survey of chunk) {
            const questions = survey.survey_questions?.questions ?? [];
            const answers = survey.survey_answer?.answers ?? [];
            const answerByQid = new Map<string, typeof answers[number]>();
            for (const a of answers) answerByQid.set(a.question_id, a);

            const qaCells: string[] = [];
            for (let j = 0; j < maxQuestionCount; j++) {
                const q = questions[j];
                if (!q) {
                    qaCells.push('', '');
                    continue;
                }
                qaCells.push(q.title, resolveAnswerText(q, answerByQid.get(q.question_id)));
            }

            // receiver_oid is null for externally-sourced surveys (external_source !== null).
            const geo = survey.receiver_oid ? workerGeoMap.get(survey.receiver_oid) : undefined;
            rows.push([
                survey.receiver_stable_id,
                geo?.country ?? '',
                geo?.region ?? '',
                geo?.location ?? '',
                survey.status,
                survey.submitted_at ?? '',
                survey.created_at,
                survey.updated_at,
                ...qaCells,
            ]);
        }

        const pct = Math.round(((i + chunk.length) / surveys.length) * 95); // reserve last 5% for downloadXlsx
        onProgress?.(pct);
        await nextFrame();
    }

    if (signal?.aborted) return;

    const safeName = batchName.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadXlsx('Surveys', headers, rows, `surveys_${safeName}_export.xlsx`);
    onProgress?.(100);
}
