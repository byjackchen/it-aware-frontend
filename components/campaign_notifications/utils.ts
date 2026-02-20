import type {
    NotificationContentBlock,
    NotificationContentLinkBlock,
    NotificationContentTextBlock,
    NotificationContentTitleBlock,
} from '@/lib/types/objects';
import type {
    NotificationReceiverContentParseResult,
    NotificationReceiverContentRowDraft,
    NotificationReceiverContentRowError,
} from './types';
import { read, utils as xlsxUtils, write } from 'xlsx';

const MAX_TEMPLATE_BLOCKS = 20;
const TEMPLATE_SHEET_NAME = 'notification_rows';

export function makeDraftId(): string {
    return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyBlock(type: NotificationContentBlock['type'] = 'text'): NotificationContentBlock {
    if (type === 'title') {
        const block: NotificationContentTitleBlock = {
            type: 'title',
            text: '',
        };
        return block;
    }

    if (type === 'link') {
        const block: NotificationContentLinkBlock = {
            type: 'link',
            text: '',
            url: '',
        };
        return block;
    }

    const block: NotificationContentTextBlock = {
        type: 'text',
        text: '',
    };
    return block;
}

export function cloneContentBlocks(blocks: NotificationContentBlock[]): NotificationContentBlock[] {
    return blocks.map((block) => ({ ...block }));
}

export function summarizeContentBlocks(blocks: NotificationContentBlock[]): string {
    if (blocks.length === 0) return '—';
    const first = blocks[0];
    if (first.type === 'link') {
        return `${first.text || 'Link'} (${first.url || ''})`;
    }
    return first.text || '—';
}

function createEmptyParseResult(fatalError: string | null = null): NotificationReceiverContentParseResult {
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

function parseContentBlocksFromRow(
    columns: string[],
    headerIndexMap: Map<string, number>
): { blocks: NotificationContentBlock[]; errors: string[] } {
    const blocks: NotificationContentBlock[] = [];
    const errors: string[] = [];

    for (let i = 1; i <= MAX_TEMPLATE_BLOCKS; i += 1) {
        const suffix = String(i).padStart(2, '0');
        const typeKey = `block_${suffix}_type`;
        const textKey = `block_${suffix}_text`;
        const urlKey = `block_${suffix}_url`;

        const typeRaw = getCellValue(columns, headerIndexMap, typeKey).toLowerCase();
        const text = getCellValue(columns, headerIndexMap, textKey);
        const url = getCellValue(columns, headerIndexMap, urlKey);

        if (!typeRaw && !text && !url) continue;

        if (!typeRaw) {
            errors.push(`${typeKey} is required when block data exists`);
            continue;
        }

        if (typeRaw !== 'text' && typeRaw !== 'title' && typeRaw !== 'link') {
            errors.push(`${typeKey} must be one of: text, title, link`);
            continue;
        }

        if (!text) {
            errors.push(`${textKey} is required`);
            continue;
        }

        if (typeRaw === 'link' && !url) {
            errors.push(`${urlKey} is required for link type`);
            continue;
        }

        if (typeRaw === 'link') {
            blocks.push({
                type: 'link',
                text,
                url,
            });
            continue;
        }

        blocks.push({
            type: typeRaw,
            text,
        } as NotificationContentTextBlock | NotificationContentTitleBlock);
    }

    return { blocks, errors };
}

export async function parseReceiverContentSpreadsheetFile(
    file: File,
    validStableIds: Set<string>
): Promise<NotificationReceiverContentParseResult> {
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

    if (!headerIndexMap.has('receiver_stable_id')) {
        return createEmptyParseResult('Missing required receiver_stable_id column');
    }

    const rowErrors: NotificationReceiverContentRowError[] = [];
    const unmatchedStableIds = new Set<string>();
    const seenStableIds = new Set<string>();
    const parsedRows: NotificationReceiverContentRowDraft[] = [];
    let duplicateRowsIgnored = 0;
    let totalRows = 0;

    for (let rowIndex = 1; rowIndex < normalizedRows.length; rowIndex += 1) {
        const sourceRow = rowIndex + 1;
        const columns = normalizedRows[rowIndex];
        const receiverStableId = getCellValue(columns, headerIndexMap, 'receiver_stable_id');
        if (!receiverStableId) continue;

        totalRows += 1;

        if (seenStableIds.has(receiverStableId)) {
            duplicateRowsIgnored += 1;
            continue;
        }

        seenStableIds.add(receiverStableId);

        if (!validStableIds.has(receiverStableId)) {
            unmatchedStableIds.add(receiverStableId);
            continue;
        }

        const { blocks, errors } = parseContentBlocksFromRow(columns, headerIndexMap);
        if (errors.length > 0) {
            rowErrors.push({
                sourceRow,
                receiverStableId,
                message: errors.join('; '),
            });
            continue;
        }

        if (blocks.length === 0) {
            rowErrors.push({
                sourceRow,
                receiverStableId,
                message: 'At least one valid content block is required',
            });
            continue;
        }

        parsedRows.push({
            receiverStableId,
            contentBlocks: blocks,
            sourceRow,
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

export function buildReceiverContentTemplateXlsx(): Uint8Array {
    const workbook = xlsxUtils.book_new();

    const headers: string[] = ['receiver_stable_id'];
    for (let i = 1; i <= MAX_TEMPLATE_BLOCKS; i += 1) {
        const suffix = String(i).padStart(2, '0');
        headers.push(`block_${suffix}_type`);
        headers.push(`block_${suffix}_text`);
        headers.push(`block_${suffix}_url`);
    }

    const exampleRowA = new Array(headers.length).fill('');
    exampleRowA[0] = 'example_receiver_a';
    exampleRowA[1] = 'title';
    exampleRowA[2] = 'Security reminder';
    exampleRowA[4] = 'text';
    exampleRowA[5] = 'Please review your pending actions today.';

    const exampleRowB = new Array(headers.length).fill('');
    exampleRowB[0] = 'example_receiver_b';
    exampleRowB[1] = 'text';
    exampleRowB[2] = 'Click the link below for details.';
    exampleRowB[4] = 'link';
    exampleRowB[5] = 'Open dashboard';
    exampleRowB[6] = 'https://example.com/dashboard';

    const sheet = xlsxUtils.aoa_to_sheet([
        headers,
        exampleRowA,
        exampleRowB,
    ]);

    xlsxUtils.book_append_sheet(workbook, sheet, TEMPLATE_SHEET_NAME);

    const output = write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    return new Uint8Array(output);
}

export function getNotificationStatusClass(status: string): string {
    switch (status) {
        case 'ready':
            return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
        case 'running':
            return 'bg-blue-500/20 text-blue-300 border-blue-400/40';
        case 'partially_completed':
            return 'bg-amber-500/20 text-amber-300 border-amber-400/40';
        case 'completed':
            return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
        case 'cancelled':
            return 'bg-rose-500/20 text-rose-300 border-rose-400/40';
        default:
            return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
    }
}

export function getNotificationStatusRowClass(status: string): string {
    switch (status) {
        case 'created':
            return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
        case 'sent':
            return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
        case 'failed':
            return 'bg-rose-500/20 text-rose-300 border-rose-400/40';
        case 'cancelled':
            return 'bg-rose-500/20 text-rose-300 border-rose-400/40';
        default:
            return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
    }
}
