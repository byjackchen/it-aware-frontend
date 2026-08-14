import type {
    Notification,
    NotificationBatch,
    NotificationBatchChannel,
    NotificationBatchStatus,
    NotificationContentBlock,
    NotificationStatus,
} from '@/lib/types/objects';

export type CreateEntryMode = 'guided' | 'excel_direct';

/**
 * external_source value sent for receivers a user added by hand that the worker list could
 * not match. It lets the backend store them with a null receiver_oid rather than rejecting
 * the write, while keeping intentional external receivers distinguishable from typos.
 */
export const MANUAL_EXTERNAL_SOURCE = 'manual';

export interface WorkerFilters {
    locationOids: string[];
    workerTypes: string[];
}

export interface NotificationReceiverContentRowDraft {
    receiverStableId: string;
    contentBlocks: NotificationContentBlock[];
    sourceRow: number;
}

export interface NotificationReceiverContentRowError {
    sourceRow: number;
    receiverStableId: string;
    message: string;
}

export interface NotificationReceiverContentParseResult {
    rows: NotificationReceiverContentRowDraft[];
    totalRows: number;
    validRows: number;
    duplicateRowsIgnored: number;
    unmatchedStableIds: string[];
    rowErrors: NotificationReceiverContentRowError[];
    fatalError: string | null;
}

export interface NotificationListQueryState {
    status: NotificationBatchStatus | '';
    channel: NotificationBatchChannel | '';
    search: string;
}

export interface NotificationRowsQueryState {
    status: NotificationStatus | '';
    search: string;
}

export interface EditableNotification extends Notification {
    isNew?: boolean;
}

export interface ContentBlockDraft {
    id: string;
    block: NotificationContentBlock;
}

export interface NotificationListFetchState {
    items: NotificationBatch[];
    total: number;
    isLoading: boolean;
    error: string | null;
}

export interface NotificationRowsFetchState {
    items: Notification[];
    total: number;
    isLoading: boolean;
    error: string | null;
}
