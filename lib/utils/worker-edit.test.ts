import { describe, expect, it } from 'vitest';
import type { Worker } from '@/lib/types/objects';
import { changedWorkerFields, type WorkerEditDraft } from './worker-edit';

const manualWorker: Worker = {
    oid: 'AaGOb46C7BMakvfZY4PUZQ',
    worker_id: null,
    stable_id: 'someone',
    fullname: 'someone',
    email: null,
    gender: null,
    worker_type: null,
    job_category: null,
    job_subcategory: null,
    job_professional_level: null,
    job_management_level: null,
    job_band: null,
    job_title: null,
    org_oid: 'org',
    location_oid: null,
    manager_oid: null,
    hire_date: null,
    is_vip: false,
    vip_type: null,
    is_active: true,
    managed_by: 'manual',
    created_at: '2026-10-30T00:00:00Z',
    updated_at: '2026-10-30T00:00:00Z',
};

function draftOf(worker: Worker): WorkerEditDraft {
    return {
        fullname: worker.fullname,
        email: worker.email || '',
        worker_id: worker.worker_id || '',
        location_oid: worker.location_oid || '',
        gender: worker.gender || '',
        worker_type: worker.worker_type || '',
        job_category: worker.job_category || '',
        job_subcategory: worker.job_subcategory || '',
        job_professional_level: worker.job_professional_level || '',
        job_management_level: worker.job_management_level || '',
        job_band: worker.job_band || '',
        job_title: worker.job_title || '',
        is_vip: worker.is_vip,
        vip_type: worker.vip_type || '',
        is_active: worker.is_active,
        managed_by: worker.managed_by,
    };
}

describe('changedWorkerFields', () => {
    it('sends only the name when only the name changed on a Manual worker', () => {
        const draft = { ...draftOf(manualWorker), fullname: '李子成' };
        expect(changedWorkerFields(manualWorker, draft)).toEqual({ fullname: '李子成' });
    });

    it('sends nothing for an untouched form', () => {
        expect(changedWorkerFields(manualWorker, draftOf(manualWorker))).toEqual({});
    });

    it('keeps an ERP worker\'s stored email and job fields out of a name edit', () => {
        const erpWorker: Worker = {
            ...manualWorker,
            worker_id: '12345',
            email: 'someone@example.com',
            job_title: 'Engineer',
            managed_by: 'erp',
        };
        const draft = { ...draftOf(erpWorker), fullname: 'Some One' };
        expect(changedWorkerFields(erpWorker, draft)).toEqual({ fullname: 'Some One' });
    });

    it('sends an emptied field as \'\' so the backend clears it', () => {
        const worker: Worker = { ...manualWorker, email: 'old@example.com', location_oid: 'loc' };
        const draft = { ...draftOf(worker), email: '', location_oid: '' };
        expect(changedWorkerFields(worker, draft)).toEqual({ email: '', location_oid: '' });
    });

    it('clears the VIP type when VIP is turned off', () => {
        const worker: Worker = { ...manualWorker, is_vip: true, vip_type: 'Exec' };
        const draft = { ...draftOf(worker), is_vip: false };
        expect(changedWorkerFields(worker, draft)).toEqual({ is_vip: 'false', vip_type: '' });
    });

    it('sends status and managed-by changes', () => {
        const draft = { ...draftOf(manualWorker), is_active: false, managed_by: 'erp' as const };
        expect(changedWorkerFields(manualWorker, draft)).toEqual({ is_active: 'false', managed_by: 'erp' });
    });
});
