# Campaigns Module API Specifications

## Overview
Campaigns domain uses batch-child models:

- Notification batch parent table: `campaigns.notification_batchs`
- Notification child table: `campaigns.notifications`
- Survey batch parent table: `campaigns.survey_batchs`
- Survey child table: `campaigns.surveys`

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
- `status`: `ready | running | partially_completed | completed | cancelled`

### Notification Child (`campaigns.notifications`)
- `oid`, `notification_batch_oid`, `receiver_stable_id`, `receiver_oid`, `content_blocks`, `status`, `scheduled_at`, `error_message`, `created_at`, `updated_at`
- `status`: `created | sent | failed | cancelled`

### Survey Batch Parent (`campaigns.survey_batchs`)
- `oid`, `name`, `status`, `creator_account`, `total_count`, `created_at`, `updated_at`
- `status`: `draft | collecting | closed | cancelled`

### Survey Child (`campaigns.surveys`)
- `oid`, `survey_batch_oid`, `receiver_stable_id`, `receiver_oid`, `survey_questions`, `survey_answer`, `status`, `submitted_at`, `created_at`, `updated_at`
- `status`: `not_started | submitted | revoked | expired`

## Object APIs

### Notification Batch APIs

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/notification_batchs` | Create notification batch | `objects:notification_batchs:write` |
| GET | `/objects/campaigns/notification_batchs` | List notification batches | `objects:notification_batchs:read` |
| GET | `/objects/campaigns/notification_batchs/{notification_batch_oid}` | Get notification batch | `objects:notification_batchs:read` |
| PUT | `/objects/campaigns/notification_batchs/{notification_batch_oid}` | Update notification batch metadata only | `objects:notification_batchs:write` |
| POST | `/objects/campaigns/notification_batchs/{notification_batch_oid}/actions` | Notification batch action (`trigger`/`cancel`) | `objects:notification_batchs:write` |
| DELETE | `/objects/campaigns/notification_batchs/{notification_batch_oid}` | Delete notification batch | `objects:notification_batchs:write` |

Notification action request example:
```json
{ "action": "trigger" }
```

### Notification Child APIs

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications` | Create one notification row | `objects:notification_batchs:write` |
| POST | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications/batch-upsert` | Upsert notification rows by receiver | `objects:notification_batchs:write` |
| GET | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications` | List notification rows | `objects:notification_batchs:read` |
| GET | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications/{notification_oid}` | Get one notification row | `objects:notification_batchs:read` |
| PUT | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications/{notification_oid}` | Update one notification row metadata only | `objects:notification_batchs:write` |
| DELETE | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications/{notification_oid}` | Delete one notification row | `objects:notification_batchs:write` |

### Survey Batch APIs

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/survey_batchs` | Create survey batch | `objects:survey_batchs:write` |
| GET | `/objects/campaigns/survey_batchs` | List survey batches | `objects:survey_batchs:read` |
| GET | `/objects/campaigns/survey_batchs/{survey_batch_oid}` | Get survey batch | `objects:survey_batchs:read` |
| PUT | `/objects/campaigns/survey_batchs/{survey_batch_oid}` | Update survey batch metadata only | `objects:survey_batchs:write` |
| POST | `/objects/campaigns/survey_batchs/{survey_batch_oid}/actions` | Survey batch action (`publish`/`close`/`reopen`/`cancel`) | `objects:survey_batchs:write` |
| DELETE | `/objects/campaigns/survey_batchs/{survey_batch_oid}` | Delete survey batch | `objects:survey_batchs:write` |

Survey batch action request example:
```json
{ "action": "reopen" }
```

### Survey Child APIs

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys` | Create one survey row | `objects:survey_batchs:write` |
| POST | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys/batch-upsert` | Upsert survey rows by receiver | `objects:survey_batchs:write` |
| GET | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys` | List survey rows | `objects:survey_batchs:read` |
| GET | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys/{survey_oid}` | Get one survey row | `objects:survey_batchs:read` |
| PUT | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys/{survey_oid}` | Update one survey row metadata only | `objects:survey_batchs:write` |
| POST | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys/{survey_oid}/actions` | Survey row action (`submit`/`revoke`) | `objects:survey_batchs:write` |
| DELETE | `/objects/campaigns/survey_batchs/{survey_batch_oid}/surveys/{survey_oid}` | Delete one survey row | `objects:survey_batchs:write` |

Survey row action request examples:
```json
{ "action": "submit", "survey_answer": { "answers": [] } }
```
```json
{ "action": "revoke" }
```

### Cross-Batch Survey Query

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| GET | `/objects/campaigns/surveys` | List one receiver's surveys across batches | `objects:survey_batchs:read` |

Query params:
- `receiver_stable_id` (required)
- `survey_status` (optional)
- `survey_batch_status` (optional)
- `survey_batch_oid` (optional)
- `skip`, `limit`

## Removed Service APIs
- `POST /services/campaigns/trigger_notification_batch_non-block`
- `GET /services/campaigns/surveys/receiver/{receiver_stable_id}`
- `GET /services/campaigns/survey_batchs/{survey_batch_oid}/surveys/{survey_oid}/receiver/{receiver_stable_id}`
- `POST /services/campaigns/survey_batchs/{survey_batch_oid}/surveys/{survey_oid}/receiver/{receiver_stable_id}`

## Pagination Shape
All list endpoints return:

```json
{
  "items": [],
  "total": 0,
  "skip": 0,
  "limit": 100
}
```
