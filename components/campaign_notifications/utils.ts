import type {
    NotificationContentBlock,
    NotificationContentLinkBlock,
    NotificationContentTextBlock,
    NotificationContentTitleBlock,
} from '@/lib/types/objects';

export interface SpreadsheetParseResult {
    matchedStableIds: string[];
    unmatchedStableIds: string[];
    totalRows: number;
    error: string | null;
}

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

export function parseReceiverSpreadsheet(
    fileContent: string,
    validStableIds: Set<string>
): SpreadsheetParseResult {
    const normalized = fileContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
    if (!normalized) {
        return {
            matchedStableIds: [],
            unmatchedStableIds: [],
            totalRows: 0,
            error: 'Empty file',
        };
    }

    const lines = normalized
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    if (lines.length < 2) {
        return {
            matchedStableIds: [],
            unmatchedStableIds: [],
            totalRows: 0,
            error: 'File must include header and at least one row',
        };
    }

    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const headers = lines[0].split(delimiter).map((value) => value.trim().toLowerCase());
    const receiverColumnIndex = headers.findIndex((header) => header === 'receiver_stable_id');

    if (receiverColumnIndex < 0) {
        return {
            matchedStableIds: [],
            unmatchedStableIds: [],
            totalRows: 0,
            error: 'Missing required receiver_stable_id column',
        };
    }

    const matchedSet = new Set<string>();
    const unmatchedSet = new Set<string>();
    let totalRows = 0;

    for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(delimiter);
        const stableId = (columns[receiverColumnIndex] ?? '').trim();
        if (!stableId) continue;

        totalRows += 1;
        if (validStableIds.has(stableId)) {
            matchedSet.add(stableId);
        } else {
            unmatchedSet.add(stableId);
        }
    }

    return {
        matchedStableIds: Array.from(matchedSet).sort((a, b) => a.localeCompare(b)),
        unmatchedStableIds: Array.from(unmatchedSet).sort((a, b) => a.localeCompare(b)),
        totalRows,
        error: null,
    };
}

export function buildReceiverTemplateCsv(): string {
    return 'receiver_stable_id\nexample_receiver_stable_id\n';
}

export function getNotificationStatusClass(status: string): string {
    switch (status) {
        case 'created':
            return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
        case 'processing':
            return 'bg-blue-500/20 text-blue-300 border-blue-400/40';
        case 'partial':
            return 'bg-amber-500/20 text-amber-300 border-amber-400/40';
        case 'completed':
            return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
        case 'completed_with_failures':
            return 'bg-orange-500/20 text-orange-300 border-orange-400/40';
        case 'cancelled':
            return 'bg-rose-500/20 text-rose-300 border-rose-400/40';
        default:
            return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
    }
}

export function getNotificationDetailStatusClass(status: string): string {
    switch (status) {
        case 'created':
            return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
        case 'sent':
            return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
        case 'failed':
            return 'bg-rose-500/20 text-rose-300 border-rose-400/40';
        default:
            return 'bg-slate-500/20 text-slate-300 border-slate-400/40';
    }
}
