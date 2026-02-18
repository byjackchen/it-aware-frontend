import type {
    SurveyAnswer,
    SurveyAnswerPayload,
    SurveyDetailStatus,
    SurveyQuestion,
    SurveyQuestionOption,
    SurveyQuestionType,
    SurveyQuestions,
    SurveyStatus,
} from '@/lib/types/objects';
import type {
    SurveyQuestionDraft,
    SurveyQuestionOptionDraft,
    SurveySpreadsheetParseResult,
    SurveySpreadsheetRowDraft,
    SurveySpreadsheetRowError,
} from './types';
import { read, utils as xlsxUtils, write } from 'xlsx';

const MAX_TEMPLATE_QUESTIONS = 20;
const TEMPLATE_SHEET_NAME = 'survey_rows';

export function makeDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyOptionDraft(): SurveyQuestionOptionDraft {
    return {
        id: makeDraftId(),
        option_id: '',
        label: '',
    };
}

export function createEmptyQuestionDraft(type: SurveyQuestionType = 'text'): SurveyQuestionDraft {
    return {
        id: makeDraftId(),
        question_id: '',
        type,
        title: '',
        required: false,
        options: type === 'text' ? [] : [createEmptyOptionDraft()],
    };
}

export function cloneQuestionDraft(question: SurveyQuestionDraft): SurveyQuestionDraft {
    return {
        ...question,
        options: question.options.map((option) => ({ ...option })),
    };
}

export function draftFromQuestion(question: SurveyQuestion): SurveyQuestionDraft {
    return {
        id: makeDraftId(),
        question_id: question.question_id,
        type: question.type,
        title: question.title,
        required: question.required,
        options: 'options' in question
            ? question.options.map((option) => ({
                id: makeDraftId(),
                option_id: option.option_id,
                label: option.label,
            }))
            : [],
    };
}

function normalizeOption(option: SurveyQuestionOptionDraft): SurveyQuestionOption {
    return {
        option_id: option.option_id.trim(),
        label: option.label.trim(),
    };
}

function normalizeQuestion(question: SurveyQuestionDraft): SurveyQuestion {
    const base = {
        question_id: question.question_id.trim(),
        type: question.type,
        title: question.title.trim(),
        required: Boolean(question.required),
    };

    if (question.type === 'text') {
        return {
            ...base,
            type: 'text',
        };
    }

    return {
        ...base,
        type: question.type,
        options: question.options.map(normalizeOption),
    } as SurveyQuestion;
}

export function toSurveyQuestions(intro: string, questionDrafts: SurveyQuestionDraft[]): SurveyQuestions {
    return {
        intro: intro.trim(),
        questions: questionDrafts.map(normalizeQuestion),
    };
}

export function validateSurveyQuestions(questions: SurveyQuestions): string | null {
    if (questions.intro.trim().length === 0) {
        return 'Intro is required.';
    }

    if (!Array.isArray(questions.questions) || questions.questions.length === 0) {
        return 'At least one question is required.';
    }

    const questionIdSet = new Set<string>();

    for (const question of questions.questions) {
        if (question.question_id.trim().length === 0) {
            return 'Each question requires question_id.';
        }
        if (question.title.trim().length === 0) {
            return 'Each question requires title.';
        }

        if (questionIdSet.has(question.question_id)) {
            return `Duplicate question_id: ${question.question_id}`;
        }
        questionIdSet.add(question.question_id);

        if (question.type === 'single_select' || question.type === 'multi_select') {
            if (!Array.isArray(question.options) || question.options.length === 0) {
                return `Question ${question.question_id} requires options.`;
            }

            const optionIdSet = new Set<string>();
            for (const option of question.options) {
                if (option.option_id.trim().length === 0 || option.label.trim().length === 0) {
                    return `Question ${question.question_id} has invalid option.`;
                }
                if (optionIdSet.has(option.option_id)) {
                    return `Question ${question.question_id} has duplicate option_id: ${option.option_id}`;
                }
                optionIdSet.add(option.option_id);
            }
        }
    }

    return null;
}

function normalizeAnswerQuestionId(answer: SurveyAnswer): string {
    return answer.question_id;
}

export function validateSurveyAnswerPayload(
    questions: SurveyQuestions,
    answerPayload: SurveyAnswerPayload
): string | null {
    if (!answerPayload || !Array.isArray(answerPayload.answers)) {
        return 'Answer payload must contain answers array.';
    }

    const questionById = new Map(questions.questions.map((question) => [question.question_id, question]));
    const answerIdSet = new Set<string>();

    for (const answer of answerPayload.answers) {
        const questionId = normalizeAnswerQuestionId(answer);
        if (answerIdSet.has(questionId)) {
            return `Duplicate answer for question_id: ${questionId}`;
        }
        answerIdSet.add(questionId);

        const question = questionById.get(questionId);
        if (!question) {
            return `Unknown question_id in answers: ${questionId}`;
        }

        if (answer.type !== question.type) {
            return `Answer type mismatch for question_id ${questionId}.`;
        }

        if (answer.type === 'single_select') {
            if (!('selected_option_id' in answer) || answer.selected_option_id.trim().length === 0) {
                return `Question ${questionId} requires selected_option_id.`;
            }
            const options = question.type === 'single_select' || question.type === 'multi_select'
                ? question.options
                : [];
            if (!options.some((option) => option.option_id === answer.selected_option_id)) {
                return `Question ${questionId} has invalid selected_option_id.`;
            }
        }

        if (answer.type === 'multi_select') {
            if (!('selected_option_ids' in answer) || !Array.isArray(answer.selected_option_ids) || answer.selected_option_ids.length === 0) {
                return `Question ${questionId} requires selected_option_ids.`;
            }
            const options = question.type === 'single_select' || question.type === 'multi_select'
                ? question.options
                : [];
            const optionSet = new Set(options.map((option) => option.option_id));
            for (const optionId of answer.selected_option_ids) {
                if (!optionSet.has(optionId)) {
                    return `Question ${questionId} has invalid multi-select option.`;
                }
            }
        }

        if (answer.type === 'text') {
            if (!('text' in answer) || answer.text.trim().length === 0) {
                return `Question ${questionId} requires text answer.`;
            }
        }
    }

    for (const question of questions.questions) {
        if (!question.required) continue;
        if (!answerIdSet.has(question.question_id)) {
            return `Required question missing: ${question.question_id}`;
        }
    }

    return null;
}

export function summarizeSurveyAnswer(answerPayload: SurveyAnswerPayload | null): string {
    if (!answerPayload || !Array.isArray(answerPayload.answers)) return '—';
    if (answerPayload.answers.length === 0) return '—';

    const first = answerPayload.answers[0];
    if (first.type === 'single_select') {
        return `${first.question_id}: ${first.selected_option_id}`;
    }
    if (first.type === 'multi_select') {
        return `${first.question_id}: ${first.selected_option_ids.join(', ')}`;
    }
    return `${first.question_id}: ${first.text}`;
}

function createEmptyParseResult(fatalError: string | null = null): SurveySpreadsheetParseResult {
    return {
        rows: [],
        totalRows: 0,
        validRows: 0,
        duplicateRowsIgnored: 0,
        unmatchedStableIds: [],
        rowErrors: [],
        fatalError,
    };
}

function getHeaderIndexMap(headers: string[]): Map<string, number> {
    const map = new Map<string, number>();
    headers.forEach((header, index) => {
        if (!map.has(header)) {
            map.set(header, index);
        }
    });
    return map;
}

function getCellValue(columns: string[], headerIndexMap: Map<string, number>, key: string): string {
    const index = headerIndexMap.get(key);
    if (index === undefined) return '';
    return (columns[index] ?? '').trim();
}

function parseBooleanFromCell(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === 'yes' || normalized === 'y' || normalized === '1') return true;
    return false;
}

function parseQuestionOptions(rawOptions: string): { options: SurveyQuestionOption[]; errors: string[] } {
    const errors: string[] = [];
    const entries = rawOptions
        .split('|')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    if (entries.length === 0) {
        return { options: [], errors: ['options are required for select question types'] };
    }

    const options: SurveyQuestionOption[] = [];
    const optionIdSet = new Set<string>();

    for (const entry of entries) {
        const separator = entry.indexOf(':');
        if (separator <= 0 || separator === entry.length - 1) {
            errors.push(`Invalid options format entry: ${entry}`);
            continue;
        }

        const optionId = entry.slice(0, separator).trim();
        const label = entry.slice(separator + 1).trim();

        if (optionId.length === 0 || label.length === 0) {
            errors.push(`Invalid options format entry: ${entry}`);
            continue;
        }

        if (optionIdSet.has(optionId)) {
            errors.push(`Duplicate option_id: ${optionId}`);
            continue;
        }

        optionIdSet.add(optionId);
        options.push({
            option_id: optionId,
            label,
        });
    }

    return { options, errors };
}

function parseQuestionsFromRow(
    columns: string[],
    headerIndexMap: Map<string, number>
): { questions: SurveyQuestion[]; errors: string[] } {
    const questions: SurveyQuestion[] = [];
    const errors: string[] = [];

    for (let i = 1; i <= MAX_TEMPLATE_QUESTIONS; i += 1) {
        const suffix = String(i).padStart(2, '0');
        const questionId = getCellValue(columns, headerIndexMap, `q${suffix}_question_id`);
        const typeRaw = getCellValue(columns, headerIndexMap, `q${suffix}_type`).toLowerCase();
        const title = getCellValue(columns, headerIndexMap, `q${suffix}_title`);
        const requiredRaw = getCellValue(columns, headerIndexMap, `q${suffix}_required`);
        const optionsRaw = getCellValue(columns, headerIndexMap, `q${suffix}_options`);

        if (!questionId && !typeRaw && !title && !requiredRaw && !optionsRaw) {
            continue;
        }

        if (!questionId) {
            errors.push(`q${suffix}_question_id is required`);
            continue;
        }

        if (!typeRaw) {
            errors.push(`q${suffix}_type is required`);
            continue;
        }

        if (!title) {
            errors.push(`q${suffix}_title is required`);
            continue;
        }

        if (typeRaw !== 'single_select' && typeRaw !== 'multi_select' && typeRaw !== 'text') {
            errors.push(`q${suffix}_type must be single_select, multi_select, or text`);
            continue;
        }

        const questionType = typeRaw as SurveyQuestionType;
        const required = parseBooleanFromCell(requiredRaw);

        if (questionType === 'text') {
            questions.push({
                question_id: questionId,
                type: 'text',
                title,
                required,
            });
            continue;
        }

        const parsedOptions = parseQuestionOptions(optionsRaw);
        if (parsedOptions.errors.length > 0) {
            errors.push(...parsedOptions.errors.map((error) => `q${suffix}_options ${error}`));
            continue;
        }

        questions.push({
            question_id: questionId,
            type: questionType,
            title,
            required,
            options: parsedOptions.options,
        });
    }

    return { questions, errors };
}

export async function parseSurveySpreadsheetFile(
    file: File,
    validStableIds: Set<string>
): Promise<SurveySpreadsheetParseResult> {
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.xlsx')) {
        return createEmptyParseResult('Only .xlsx files are supported');
    }

    const bytes = await file.arrayBuffer();
    const workbook = read(bytes, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
        return createEmptyParseResult('Missing worksheet in .xlsx file');
    }

    const firstSheet = workbook.Sheets[firstSheetName];
    const rows = xlsxUtils.sheet_to_json(firstSheet, {
        header: 1,
        raw: false,
        defval: '',
    }) as Array<Array<string | number | boolean | null | undefined>>;

    if (rows.length < 2) {
        return createEmptyParseResult('File must include header and at least one data row');
    }

    const normalizedRows = rows.map((row) => row.map((value) => String(value ?? '').trim()));
    const headers = normalizedRows[0].map((value) => value.trim().toLowerCase());
    const headerIndexMap = getHeaderIndexMap(headers);

    if (!headerIndexMap.has('name') || !headerIndexMap.has('receiver_stable_id') || !headerIndexMap.has('intro')) {
        return createEmptyParseResult('Missing required columns: name, receiver_stable_id, intro');
    }

    const rowErrors: SurveySpreadsheetRowError[] = [];
    const unmatchedStableIds = new Set<string>();
    const seenRowKeys = new Set<string>();
    const parsedRows: SurveySpreadsheetRowDraft[] = [];
    let duplicateRowsIgnored = 0;
    let totalRows = 0;

    for (let rowIndex = 1; rowIndex < normalizedRows.length; rowIndex += 1) {
        const sourceRow = rowIndex + 1;
        const columns = normalizedRows[rowIndex];
        const rowHasAnyData = columns.some((value) => value.trim().length > 0);
        if (!rowHasAnyData) continue;

        totalRows += 1;

        const name = getCellValue(columns, headerIndexMap, 'name');
        const receiverStableId = getCellValue(columns, headerIndexMap, 'receiver_stable_id');
        const intro = getCellValue(columns, headerIndexMap, 'intro');

        if (!name) {
            rowErrors.push({
                sourceRow,
                receiverStableId,
                message: 'name is required',
            });
            continue;
        }

        if (!receiverStableId) {
            rowErrors.push({
                sourceRow,
                receiverStableId,
                message: 'receiver_stable_id is required',
            });
            continue;
        }

        if (!intro) {
            rowErrors.push({
                sourceRow,
                receiverStableId,
                message: 'intro is required',
            });
            continue;
        }

        const dedupeKey = `${name}||${receiverStableId}`;
        if (seenRowKeys.has(dedupeKey)) {
            duplicateRowsIgnored += 1;
            continue;
        }
        seenRowKeys.add(dedupeKey);

        if (!validStableIds.has(receiverStableId)) {
            unmatchedStableIds.add(receiverStableId);
            continue;
        }

        const { questions, errors } = parseQuestionsFromRow(columns, headerIndexMap);
        if (errors.length > 0) {
            rowErrors.push({
                sourceRow,
                receiverStableId,
                message: errors.join('; '),
            });
            continue;
        }

        if (questions.length === 0) {
            rowErrors.push({
                sourceRow,
                receiverStableId,
                message: 'At least one question is required',
            });
            continue;
        }

        const surveyQuestions: SurveyQuestions = {
            intro,
            questions,
        };
        const validationError = validateSurveyQuestions(surveyQuestions);
        if (validationError) {
            rowErrors.push({
                sourceRow,
                receiverStableId,
                message: validationError,
            });
            continue;
        }

        parsedRows.push({
            sourceRow,
            name,
            receiverStableId,
            surveyQuestions,
        });
    }

    return {
        rows: parsedRows,
        totalRows,
        validRows: parsedRows.length,
        duplicateRowsIgnored,
        unmatchedStableIds: Array.from(unmatchedStableIds).sort((a, b) => a.localeCompare(b)),
        rowErrors,
        fatalError: null,
    };
}

export function buildSurveySpreadsheetTemplateXlsx(): Uint8Array {
    const workbook = xlsxUtils.book_new();

    const headers: string[] = ['name', 'receiver_stable_id', 'intro'];
    for (let i = 1; i <= MAX_TEMPLATE_QUESTIONS; i += 1) {
        const suffix = String(i).padStart(2, '0');
        headers.push(`q${suffix}_question_id`);
        headers.push(`q${suffix}_type`);
        headers.push(`q${suffix}_title`);
        headers.push(`q${suffix}_required`);
        headers.push(`q${suffix}_options`);
    }

    const exampleRowA = new Array(headers.length).fill('');
    exampleRowA[0] = 'employee_pulse_alice';
    exampleRowA[1] = 'alice_wxid';
    exampleRowA[2] = 'Please complete this short pulse survey.';
    exampleRowA[3] = 'q1';
    exampleRowA[4] = 'single_select';
    exampleRowA[5] = 'How satisfied are you?';
    exampleRowA[6] = 'true';
    exampleRowA[7] = 'a:Good|b:Bad';
    exampleRowA[8] = 'q2';
    exampleRowA[9] = 'text';
    exampleRowA[10] = 'Any comment?';
    exampleRowA[11] = 'false';

    const exampleRowB = new Array(headers.length).fill('');
    exampleRowB[0] = 'employee_pulse_bob';
    exampleRowB[1] = 'bob_wxid';
    exampleRowB[2] = 'We value your feedback.';
    exampleRowB[3] = 'q1';
    exampleRowB[4] = 'multi_select';
    exampleRowB[5] = 'Which tools do you use?';
    exampleRowB[6] = 'true';
    exampleRowB[7] = 'jira:Jira|slack:Slack|wiki:Wiki';

    const sheet = xlsxUtils.aoa_to_sheet([
        headers,
        exampleRowA,
        exampleRowB,
    ]);

    xlsxUtils.book_append_sheet(workbook, sheet, TEMPLATE_SHEET_NAME);

    const output = write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    return new Uint8Array(output);
}

export function parseSurveyAnswerJson(value: string): SurveyAnswerPayload | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;

    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Survey answer must be a JSON object');
    }

    const answers = (parsed as { answers?: unknown }).answers;
    if (!Array.isArray(answers)) {
        throw new Error('Survey answer must include answers array');
    }

    return parsed as SurveyAnswerPayload;
}

export function stringifySurveyAnswer(answerPayload: SurveyAnswerPayload | null): string {
    if (!answerPayload) return '';
    return JSON.stringify(answerPayload, null, 2);
}

export function getSurveyStatusClass(status: SurveyStatus | string): string {
    switch (status) {
        case 'created':
            return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
        case 'partial':
            return 'bg-amber-500/20 text-amber-300 border-amber-400/40';
        case 'completed':
            return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
        case 'cancelled':
            return 'bg-rose-500/20 text-rose-300 border-rose-400/40';
        default:
            return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
    }
}

export function getSurveyDetailStatusClass(status: SurveyDetailStatus | string): string {
    switch (status) {
        case 'created':
            return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
        case 'submitted':
            return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
        default:
            return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
    }
}
