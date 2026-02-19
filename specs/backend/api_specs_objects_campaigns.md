# Campaigns Module API Specifications

## Overview
Campaigns domain now uses a strict batch-child model:

- Notification batch parent table: `campaigns.notification_batchs`
- Notification child table: `campaigns.notifications`
- Survey batch parent table: `campaigns.survey_batchs`
- Survey child table: `campaigns.surveys`

Child-row identity and receiver rules:

- `campaigns.notifications.oid` and `campaigns.surveys.oid` are row primary keys.
- `receiver_oid` is nullable and FK to `objects.workers.oid`.
- Within one batch, `receiver_stable_id` is unique.
- Create/upsert routes accept optional `receiver_oid`; if omitted, backend resolves by `receiver_stable_id`.

## Security Model
All endpoints require authentication.

| Resource | Read Permission | Write Permission |
|----------|-----------------|------------------|
| Notification Batch | `objects:notification_batchs:read` | `objects:notification_batchs:write` |
| Survey Batch | `objects:survey_batchs:read` | `objects:survey_batchs:write` |

## Data Models

### Notification Batch Parent (`campaigns.notification_batchs`)
- `oid`, `name`, `channel`, `status`, `run_id`, `creator_account`, `total_count`, `created_at`, `updated_at`
- `channel`: `wecom_bot | wecom_ops_bot`
- `status`: `created | processing | partial | completed | completed_with_failures | cancelled`

### Notification Child (`campaigns.notifications`)
- `oid`, `notification_batch_oid`, `receiver_stable_id`, `receiver_oid`, `content_blocks`, `status`, `scheduled_at`, `error_message`, `created_at`, `updated_at`
- `status`: `created | sent | failed`

### Survey Batch Parent (`campaigns.survey_batchs`)
- `oid`, `name`, `status`, `creator_account`, `total_count`, `created_at`, `updated_at`
- `status`: `created | partial | completed | cancelled`

### Survey Child (`campaigns.surveys`)
- `oid`, `survey_batch_oid`, `receiver_stable_id`, `receiver_oid`, `survey_questions`, `survey_answer`, `status`, `submitted_at`, `created_at`, `updated_at`
- `status`: `created | submitted`

## Object APIs

### Notification Batch APIs (`/objects/campaigns/notification_batchs`)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/notification_batchs` | Create notification batch | `objects:notification_batchs:write` |
| GET | `/objects/campaigns/notification_batchs` | List notification batches | `objects:notification_batchs:read` |
| GET | `/objects/campaigns/notification_batchs/{notification_batch_oid}` | Get notification batch | `objects:notification_batchs:read` |
| PUT | `/objects/campaigns/notification_batchs/{notification_batch_oid}` | Update notification batch | `objects:notification_batchs:write` |
| DELETE | `/objects/campaigns/notification_batchs/{notification_batch_oid}` | Delete notification batch | `objects:notification_batchs:write` |

### Notification Child APIs (`/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications`)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications` | Create one notification row | `objects:notification_batchs:write` |
| POST | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications/batch-upsert` | Upsert notification rows by receiver | `objects:notification_batchs:write` |
| GET | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications` | List notification rows | `objects:notification_batchs:read` |
| GET | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications/{notification_oid}` | Get one notification row | `objects:notification_batchs:read` |
| PUT | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications/{notification_oid}` | Update one notification row | `objects:notification_batchs:write` |
| DELETE | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications/{notification_oid}` | Delete one notification row | `objects:notification_batchs:write` |

### Survey Batch APIs (`/objects/campaigns/survey_batchs`)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/survey_batchs` | Create survey batch | `objects:survey_batchs:write` |
| GET | `/objects/campaigns/survey_batchs` | List survey batches | `objects:survey_batchs:read` |
| GET | `/objects/campaigns/survey_batchs/{survey_batch_oid}` | Get survey batch | `objects:survey_batchs:read` |
| PUT | `/objects/campaigns/survey_batchs/{survey_batch_oid}` | Update survey batch | `objects:survey_batchs:write` |
| DELETE | `/objects/campaigns/survey_batchs/{survey_batch_oid}` | Delete survey batch | `objects:survey_batchs:write` |

### Survey Child APIs (`/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys`)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys` | Create one survey row | `objects:survey_batchs:write` |
| POST | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys/batch-upsert` | Upsert survey rows by receiver | `objects:survey_batchs:write` |
| GET | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys` | List survey rows | `objects:survey_batchs:read` |
| GET | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys/{survey_oid}` | Get one survey row | `objects:survey_batchs:read` |
| PUT | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys/{survey_oid}` | Update one survey row | `objects:survey_batchs:write` |
| DELETE | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys/{survey_oid}` | Delete one survey row | `objects:survey_batchs:write` |

## Service APIs (`/services/campaigns`)

### Notification Batch Trigger (Non-Block)
- `POST /services/campaigns/trigger_notification_batch_non-block`
- Request:
```json
{
  "notification_batch_oid": "..."
}
```
- Response (`202`):
```json
{
  "notification_batch_oid": "...",
  "status": "processing",
  "to_process_count": 12,
  "run_id": "manual__trigger_notification_batch__..."
}
```
- Behavior:
  - requires batch status `created`
  - claims batch (`created -> processing`) and persists `run_id`
  - triggers Airflow DAG `services_trigger_notification_batch`
  - rolls back claim on trigger failure

### Survey Receiver Service
- `GET /services/campaigns/survey_batchs/{survey_batch_oid}/surveys/{survey_oid}/receiver/{receiver_stable_id}`
- `POST /services/campaigns/survey_batchs/{survey_batch_oid}/surveys/{survey_oid}/receiver/{receiver_stable_id}`

Operation POST request:
```json
{
  "operation": "submit",
  "survey_answer": {"answers": []}
}
```
or
```json
{
  "operation": "revoke"
}
```

Behavior:
- path is stable-id based under batch
- submit: `created -> submitted`
- revoke: `submitted -> created`
- validates answers against persisted `survey_questions`

## Pagination Shape
All list endpoints return the unified envelope:

```json
{
  "items": [],
  "total": 0,
  "skip": 0,
  "limit": 100
}
```
