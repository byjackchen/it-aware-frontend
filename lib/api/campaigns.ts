/**
 * Server-side API client for Campaign module.
 */

import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { fetchApi } from '@/lib/api/core';
import type {
    Notification,
    NotificationCreate,
    NotificationDetail,
    NotificationDetailCreate,
    NotificationDetailListParams,
    NotificationDetailListResponse,
    NotificationDetailUpdate,
    NotificationListParams,
    NotificationListResponse,
    NotificationTriggerResponse,
    NotificationUpdate,
    Survey,
    SurveyCreate,
    SurveyDetail,
    SurveyDetailCreate,
    SurveyDetailListParams,
    SurveyDetailListResponse,
    SurveyDetailUpdate,
    SurveyListParams,
    SurveyListResponse,
    SurveyUpdate,
} from '@/lib/types/objects';

const NOTIFICATIONS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects/campaigns/notifications`;
const SURVEYS_BASE = `${RUNTIME_CONFIG.backend.domain}/objects/campaigns/surveys`;
const CAMPAIGN_SERVICES_BASE = `${RUNTIME_CONFIG.backend.domain}/services/campaigns`;

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

export async function getNotifications(params: NotificationListParams = {}): Promise<NotificationListResponse> {
    const query = new URLSearchParams();
    setOptionalQueryParam(query, 'status', params.status);
    setOptionalQueryParam(query, 'channel', params.channel);
    if (params.skip !== undefined) query.set('skip', String(params.skip));
    if (params.limit !== undefined) query.set('limit', String(params.limit));

    return fetchApi<NotificationListResponse>(withQuery(NOTIFICATIONS_BASE, query));
}

export async function getNotification(oid: string): Promise<Notification> {
    return fetchApi<Notification>(`${NOTIFICATIONS_BASE}/${encodeURIComponent(oid)}`);
}

export async function createNotification(data: NotificationCreate): Promise<Notification> {
    return fetchApi<Notification>(NOTIFICATIONS_BASE, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateNotification(oid: string, data: NotificationUpdate): Promise<Notification> {
    return fetchApi<Notification>(`${NOTIFICATIONS_BASE}/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteNotification(oid: string): Promise<void> {
    return fetchApi<void>(`${NOTIFICATIONS_BASE}/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

export async function getNotificationDetails(
    notificationOid: string,
    params: NotificationDetailListParams = {}
): Promise<NotificationDetailListResponse> {
    const query = new URLSearchParams();
    setOptionalQueryParam(query, 'status', params.status);
    setOptionalQueryParam(query, 'receiver_stable_id', params.receiver_stable_id);
    setOptionalQueryParam(query, 'scheduled_at_from', params.scheduled_at_from);
    setOptionalQueryParam(query, 'scheduled_at_to', params.scheduled_at_to);
    if (params.skip !== undefined) query.set('skip', String(params.skip));
    if (params.limit !== undefined) query.set('limit', String(params.limit));

    return fetchApi<NotificationDetailListResponse>(
        withQuery(`${NOTIFICATIONS_BASE}/${encodeURIComponent(notificationOid)}/details`, query)
    );
}

export async function getNotificationDetail(notificationOid: string, receiverStableId: string): Promise<NotificationDetail> {
    return fetchApi<NotificationDetail>(
        `${NOTIFICATIONS_BASE}/${encodeURIComponent(notificationOid)}/details/${encodeURIComponent(receiverStableId)}`
    );
}

export async function createNotificationDetail(notificationOid: string, data: NotificationDetailCreate): Promise<NotificationDetail> {
    return fetchApi<NotificationDetail>(`${NOTIFICATIONS_BASE}/${encodeURIComponent(notificationOid)}/details`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function batchUpsertNotificationDetails(
    notificationOid: string,
    details: NotificationDetailCreate[]
): Promise<NotificationDetailListResponse> {
    return fetchApi<NotificationDetailListResponse>(
        `${NOTIFICATIONS_BASE}/${encodeURIComponent(notificationOid)}/details/batch-upsert`,
        {
            method: 'POST',
            body: JSON.stringify({ details }),
        }
    );
}

export async function updateNotificationDetail(
    notificationOid: string,
    receiverStableId: string,
    data: NotificationDetailUpdate
): Promise<NotificationDetail> {
    return fetchApi<NotificationDetail>(
        `${NOTIFICATIONS_BASE}/${encodeURIComponent(notificationOid)}/details/${encodeURIComponent(receiverStableId)}`,
        {
            method: 'PUT',
            body: JSON.stringify(data),
        }
    );
}

export async function deleteNotificationDetail(notificationOid: string, receiverStableId: string): Promise<void> {
    return fetchApi<void>(
        `${NOTIFICATIONS_BASE}/${encodeURIComponent(notificationOid)}/details/${encodeURIComponent(receiverStableId)}`,
        {
            method: 'DELETE',
        }
    );
}

export async function getSurveys(params: SurveyListParams = {}): Promise<SurveyListResponse> {
    const query = new URLSearchParams();
    setOptionalQueryParam(query, 'status', params.status);
    if (params.skip !== undefined) query.set('skip', String(params.skip));
    if (params.limit !== undefined) query.set('limit', String(params.limit));

    return fetchApi<SurveyListResponse>(withQuery(SURVEYS_BASE, query));
}

export async function getSurvey(oid: string): Promise<Survey> {
    return fetchApi<Survey>(`${SURVEYS_BASE}/${encodeURIComponent(oid)}`);
}

export async function createSurvey(data: SurveyCreate): Promise<Survey> {
    return fetchApi<Survey>(SURVEYS_BASE, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function updateSurvey(oid: string, data: SurveyUpdate): Promise<Survey> {
    return fetchApi<Survey>(`${SURVEYS_BASE}/${encodeURIComponent(oid)}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deleteSurvey(oid: string): Promise<void> {
    return fetchApi<void>(`${SURVEYS_BASE}/${encodeURIComponent(oid)}`, {
        method: 'DELETE',
    });
}

export async function getSurveyDetails(
    surveyOid: string,
    params: SurveyDetailListParams = {}
): Promise<SurveyDetailListResponse> {
    const query = new URLSearchParams();
    setOptionalQueryParam(query, 'status', params.status);
    setOptionalQueryParam(query, 'receiver_stable_id', params.receiver_stable_id);
    setOptionalQueryParam(query, 'submitted_at_from', params.submitted_at_from);
    setOptionalQueryParam(query, 'submitted_at_to', params.submitted_at_to);
    if (params.skip !== undefined) query.set('skip', String(params.skip));
    if (params.limit !== undefined) query.set('limit', String(params.limit));

    return fetchApi<SurveyDetailListResponse>(
        withQuery(`${SURVEYS_BASE}/${encodeURIComponent(surveyOid)}/details`, query)
    );
}

export async function getSurveyDetail(surveyOid: string, receiverStableId: string): Promise<SurveyDetail> {
    return fetchApi<SurveyDetail>(
        `${SURVEYS_BASE}/${encodeURIComponent(surveyOid)}/details/${encodeURIComponent(receiverStableId)}`
    );
}

export async function createSurveyDetail(surveyOid: string, data: SurveyDetailCreate): Promise<SurveyDetail> {
    return fetchApi<SurveyDetail>(`${SURVEYS_BASE}/${encodeURIComponent(surveyOid)}/details`, {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function batchUpsertSurveyDetails(
    surveyOid: string,
    details: SurveyDetailCreate[]
): Promise<SurveyDetailListResponse> {
    return fetchApi<SurveyDetailListResponse>(
        `${SURVEYS_BASE}/${encodeURIComponent(surveyOid)}/details/batch-upsert`,
        {
            method: 'POST',
            body: JSON.stringify({ details }),
        }
    );
}

export async function updateSurveyDetail(
    surveyOid: string,
    receiverStableId: string,
    data: SurveyDetailUpdate
): Promise<SurveyDetail> {
    return fetchApi<SurveyDetail>(
        `${SURVEYS_BASE}/${encodeURIComponent(surveyOid)}/details/${encodeURIComponent(receiverStableId)}`,
        {
            method: 'PUT',
            body: JSON.stringify(data),
        }
    );
}

export async function deleteSurveyDetail(surveyOid: string, receiverStableId: string): Promise<void> {
    return fetchApi<void>(
        `${SURVEYS_BASE}/${encodeURIComponent(surveyOid)}/details/${encodeURIComponent(receiverStableId)}`,
        {
            method: 'DELETE',
        }
    );
}

export async function triggerNotificationNonBlock(notificationOid: string): Promise<NotificationTriggerResponse> {
    return fetchApi<NotificationTriggerResponse>(`${CAMPAIGN_SERVICES_BASE}/trigger_notification_non-block`, {
        method: 'POST',
        body: JSON.stringify({ notification_oid: notificationOid }),
    });
}
