/**
 * Server-side API client for Campaign module.
 */

import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { fetchApi } from '@/lib/api/core';
import type {
    CrossBatchSurveyListParams,
    Notification,
    NotificationBatch,
    NotificationBatchActionRequest,
    NotificationBatchCreate,
    NotificationBatchListParams,
    NotificationBatchListResponse,
    NotificationBatchUpdate,
    NotificationCreate,
    NotificationListParams,
    NotificationListResponse,
    NotificationUpdate,
    Survey,
    SurveyActionRequest,
    SurveyBatch,
    SurveyBatchActionRequest,
    SurveyBatchCreate,
    SurveyBatchListParams,
    SurveyBatchListResponse,
    SurveyBatchUpdate,
    SurveyCreate,
    SurveyListParams,
    SurveyListResponse,
    SurveyUpdate,
} from '@/lib/types/objects';

const NOTIFICATION_BATCHS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects/campaigns/notification_batchs`;
const SURVEY_BATCHS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects/campaigns/survey_batchs`;
const SURVEYS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects/campaigns/surveys`;

function setOptionalQueryParam(query: URLSearchParams, key: string, value: string | number | undefined): void {
    if (value === undefined) return;
    const normalized = String(value).trim();
    if (normalized.length === 0) return;
    query.set(key, normalized);
}

function withQuery(baseUrl: string, query: URLSearchParams): string {
    const queryString = query.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

// Notification batch parent APIs
export async function getNotificationBatches(params: NotificationBatchListParams = {}): Promise<NotificationBatchListResponse> {
    const query = new URLSearchParams();
    setOptionalQueryParam(query, 'status', params.status);
    setOptionalQueryParam(query, 'channel', params.channel);
    if (params.skip !== undefined) query.set('skip', String(params.skip));
    if (params.limit !== undefined) query.set('limit', String(params.limit));

    return fetchApi<NotificationBatchListResponse>(withQuery(NOTIFICATION_BATCHS_BASE, query));
}

export async function getNotificationBatch(oid: string): Promise<NotificationBatch> {
    return fetchApi<NotificationBatch>(`${NOTIFICATION_BATCHS_BASE}/${encodeURIComponent(oid)}`);
}

export async function createNotificationBatch(data: NotificationBatchCreate): Promise<NotificationBatch> {
    return fetchApi<NotificationBatch>(NOTIFICATION_BATCHS_BASE, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateNotificationBatch(oid: string, data: NotificationBatchUpdate): Promise<NotificationBatch> {
    return fetchApi<NotificationBatch>(`${NOTIFICATION_BATCHS_BASE}/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteNotificationBatch(oid: string): Promise<void> {
    return fetchApi<void>(`${NOTIFICATION_BATCHS_BASE}/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

export async function postNotificationBatchAction(
    notificationBatchOid: string,
    payload: NotificationBatchActionRequest
): Promise<NotificationBatch> {
    return fetchApi<NotificationBatch>(
        `${NOTIFICATION_BATCHS_BASE}/${encodeURIComponent(notificationBatchOid)}/actions`,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    );
}

// Notification child APIs
export async function getNotifications(
    notificationBatchOid: string,
    params: NotificationListParams = {}
): Promise<NotificationListResponse> {
    const query = new URLSearchParams();
    setOptionalQueryParam(query, 'status', params.status);
    setOptionalQueryParam(query, 'receiver_stable_id', params.receiver_stable_id);
    setOptionalQueryParam(query, 'scheduled_at_from', params.scheduled_at_from);
    setOptionalQueryParam(query, 'scheduled_at_to', params.scheduled_at_to);
    if (params.skip !== undefined) query.set('skip', String(params.skip));
    if (params.limit !== undefined) query.set('limit', String(params.limit));

    return fetchApi<NotificationListResponse>(
        withQuery(`${NOTIFICATION_BATCHS_BASE}/${encodeURIComponent(notificationBatchOid)}/notifications`, query)
    );
}

export async function getNotification(notificationBatchOid: string, notificationOid: string): Promise<Notification> {
    return fetchApi<Notification>(
        `${NOTIFICATION_BATCHS_BASE}/${encodeURIComponent(notificationBatchOid)}/notifications/${encodeURIComponent(notificationOid)}`
    );
}

export async function createNotification(
    notificationBatchOid: string,
    data: NotificationCreate
): Promise<Notification> {
    return fetchApi<Notification>(
        `${NOTIFICATION_BATCHS_BASE}/${encodeURIComponent(notificationBatchOid)}/notifications`,
        {
            method: 'POST',
            body: JSON.stringify(data),
        }
    );
}

export async function batchUpsertNotifications(
    notificationBatchOid: string,
    notifications: NotificationCreate[]
): Promise<NotificationListResponse> {
    return fetchApi<NotificationListResponse>(
        `${NOTIFICATION_BATCHS_BASE}/${encodeURIComponent(notificationBatchOid)}/notifications/batch-upsert`,
        {
            method: 'POST',
            body: JSON.stringify({ notifications }),
        }
    );
}

export async function updateNotification(
    notificationBatchOid: string,
    notificationOid: string,
    data: NotificationUpdate
): Promise<Notification> {
    return fetchApi<Notification>(
        `${NOTIFICATION_BATCHS_BASE}/${encodeURIComponent(notificationBatchOid)}/notifications/${encodeURIComponent(notificationOid)}`,
        {
            method: 'PUT',
            body: JSON.stringify(data),
        }
    );
}

export async function deleteNotification(notificationBatchOid: string, notificationOid: string): Promise<void> {
    return fetchApi<void>(
        `${NOTIFICATION_BATCHS_BASE}/${encodeURIComponent(notificationBatchOid)}/notifications/${encodeURIComponent(notificationOid)}`,
        {
            method: 'DELETE',
        }
    );
}

// Survey batch parent APIs
export async function getSurveyBatches(params: SurveyBatchListParams = {}): Promise<SurveyBatchListResponse> {
    const query = new URLSearchParams();
    setOptionalQueryParam(query, 'status', params.status);
    if (params.skip !== undefined) query.set('skip', String(params.skip));
    if (params.limit !== undefined) query.set('limit', String(params.limit));

    return fetchApi<SurveyBatchListResponse>(withQuery(SURVEY_BATCHS_BASE, query));
}

export async function getSurveyBatch(oid: string): Promise<SurveyBatch> {
    return fetchApi<SurveyBatch>(`${SURVEY_BATCHS_BASE}/${encodeURIComponent(oid)}`);
}

export async function createSurveyBatch(data: SurveyBatchCreate): Promise<SurveyBatch> {
    return fetchApi<SurveyBatch>(SURVEY_BATCHS_BASE, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateSurveyBatch(oid: string, data: SurveyBatchUpdate): Promise<SurveyBatch> {
    return fetchApi<SurveyBatch>(`${SURVEY_BATCHS_BASE}/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteSurveyBatch(oid: string): Promise<void> {
    return fetchApi<void>(`${SURVEY_BATCHS_BASE}/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

export async function postSurveyBatchAction(
    surveyBatchOid: string,
    payload: SurveyBatchActionRequest
): Promise<SurveyBatch> {
    return fetchApi<SurveyBatch>(
        `${SURVEY_BATCHS_BASE}/${encodeURIComponent(surveyBatchOid)}/actions`,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    );
}

// Survey child APIs
export async function getSurveys(
    surveyBatchOid: string,
    params: SurveyListParams = {}
): Promise<SurveyListResponse> {
    const query = new URLSearchParams();
    setOptionalQueryParam(query, 'status', params.status);
    setOptionalQueryParam(query, 'receiver_stable_id', params.receiver_stable_id);
    setOptionalQueryParam(query, 'external_source', params.external_source);
    setOptionalQueryParam(query, 'context_type', params.context_type);
    setOptionalQueryParam(query, 'context_oid', params.context_oid);
    setOptionalQueryParam(query, 'external_id', params.external_id);
    setOptionalQueryParam(query, 'submitted_at_from', params.submitted_at_from);
    setOptionalQueryParam(query, 'submitted_at_to', params.submitted_at_to);
    if (params.skip !== undefined) query.set('skip', String(params.skip));
    if (params.limit !== undefined) query.set('limit', String(params.limit));

    return fetchApi<SurveyListResponse>(
        withQuery(`${SURVEY_BATCHS_BASE}/${encodeURIComponent(surveyBatchOid)}/surveys`, query)
    );
}

export async function getSurvey(surveyOid: string): Promise<Survey> {
    return fetchApi<Survey>(
        `${SURVEYS_BASE}/${encodeURIComponent(surveyOid)}`
    );
}

export async function createSurvey(
    surveyBatchOid: string,
    data: SurveyCreate
): Promise<Survey> {
    return fetchApi<Survey>(`${SURVEY_BATCHS_BASE}/${encodeURIComponent(surveyBatchOid)}/surveys`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function batchUpsertSurveys(
    surveyBatchOid: string,
    surveys: SurveyCreate[]
): Promise<SurveyListResponse> {
    return fetchApi<SurveyListResponse>(
        `${SURVEY_BATCHS_BASE}/${encodeURIComponent(surveyBatchOid)}/surveys/batch-upsert`,
        {
            method: 'POST',
            body: JSON.stringify({ surveys }),
        }
    );
}

export async function updateSurvey(
    surveyOid: string,
    data: SurveyUpdate
): Promise<Survey> {
    return fetchApi<Survey>(
        `${SURVEYS_BASE}/${encodeURIComponent(surveyOid)}`,
        {
            method: 'PUT',
            body: JSON.stringify(data),
        }
    );
}

export async function deleteSurvey(surveyOid: string): Promise<void> {
    return fetchApi<void>(
        `${SURVEYS_BASE}/${encodeURIComponent(surveyOid)}`,
        {
            method: 'DELETE',
        }
    );
}

export async function postSurveyAction(
    surveyOid: string,
    payload: SurveyActionRequest
): Promise<Survey> {
    return fetchApi<Survey>(
        `${SURVEYS_BASE}/${encodeURIComponent(surveyOid)}/actions`,
        {
            method: 'POST',
            body: JSON.stringify(payload),
        }
    );
}

export async function getCampaignSurveys(params: CrossBatchSurveyListParams): Promise<SurveyListResponse> {
    const query = new URLSearchParams();
    setOptionalQueryParam(query, 'receiver_stable_id', params.receiver_stable_id);
    setOptionalQueryParam(query, 'survey_status', params.survey_status);
    setOptionalQueryParam(query, 'survey_batch_status', params.survey_batch_status);
    setOptionalQueryParam(query, 'survey_batch_oid', params.survey_batch_oid);
    setOptionalQueryParam(query, 'external_source', params.external_source);
    setOptionalQueryParam(query, 'context_type', params.context_type);
    setOptionalQueryParam(query, 'context_oid', params.context_oid);
    setOptionalQueryParam(query, 'external_id', params.external_id);
    if (params.skip !== undefined) query.set('skip', String(params.skip));
    if (params.limit !== undefined) query.set('limit', String(params.limit));

    return fetchApi<SurveyListResponse>(withQuery(SURVEYS_BASE, query));
}
