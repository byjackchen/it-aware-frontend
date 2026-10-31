import type { Worker, WorkerManagedBy } from '@/lib/types/objects';

/** The worker detail form's values; empty text fields are ''. */
export interface WorkerEditDraft {
    fullname: string;
    email: string;
    worker_id: string;
    location_oid: string;
    gender: string;
    worker_type: string;
    job_category: string;
    job_subcategory: string;
    job_professional_level: string;
    job_management_level: string;
    job_band: string;
    job_title: string;
    is_vip: boolean;
    vip_type: string;
    is_active: boolean;
    managed_by: WorkerManagedBy;
}

const TEXT_FIELDS = [
    'fullname',
    'email',
    'worker_id',
    'location_oid',
    'gender',
    'worker_type',
    'job_category',
    'job_subcategory',
    'job_professional_level',
    'job_management_level',
    'job_band',
    'job_title',
] as const;

/**
 * Form fields the user changed, as strings for updateWorkerAction.
 *
 * Unchanged fields are left out so the update keeps their stored values:
 * sending '' for an empty field would store '' over NULL, clear the unique
 * email and worker_id, and count as a sensitive-field edit.
 */
export function changedWorkerFields(worker: Worker, draft: WorkerEditDraft): Record<string, string> {
    const changes: Record<string, string> = {};
    for (const field of TEXT_FIELDS) {
        if (draft[field] !== (worker[field] ?? '')) changes[field] = draft[field];
    }
    const vipType = draft.is_vip ? draft.vip_type : '';
    if (draft.is_vip !== worker.is_vip) changes.is_vip = String(draft.is_vip);
    if (vipType !== (worker.vip_type ?? '')) changes.vip_type = vipType;
    if (draft.is_active !== worker.is_active) changes.is_active = String(draft.is_active);
    if (draft.managed_by !== worker.managed_by) changes.managed_by = draft.managed_by;
    return changes;
}
