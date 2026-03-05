# Campaigns Module API Specifications

## Overview
Campaigns domain uses batch-child models:

- Notification batch parent table: `campaigns.notification_batchs`
- Notification child table: `campaigns.notifications`
- Survey batch parent table: `campaigns.survey_batchs`
- Survey child table: `campaigns.surveys`

This spec is the canonical contract for campaign object APIs. For external migration
and rollout guidance, see
`/Users/byjackchen/codespace/it-aware-backend/specs/objects/campaign_external_consumer_changes_20260222.md`.

## Security Model
All endpoints require authentication.

| Resource | Read Permission | Write Permission |
|----------|-----------------|------------------|
| Notification Batch | `objects:notification_batchs:read` | `objects:notification_batchs:write` |
| Survey Batch | `objects:survey_batchs:read` | `objects:survey_batchs:write` |

## Data Models

### Notification Batch Parent (`campaigns.notification_batchs`)
- `oid`, `name`, `channel`, `status`, `run_id`, `creator_account`, `total_count`, `image_type`, `image_id`, `image_base64`, `created_at`, `updated_at`
- `channel`: `wecom_bot | wecom_ops_bot`
- `status`: `ready | running | partially_completed | completed | cancelled`
- image field semantics:
  - `image_type`: image MIME type (`image/*`) for parent-level campaign media
  - `image_id`: external media id returned by `upload_image`
  - `image_base64`: source image payload (plain base64 or `data:<mime>;base64,...`)
- constraints:
  - image fields are parent-level only (not stored on child `notifications` rows)
  - for `channel=wecom_ops_bot`, image fields must be `null`
  - list endpoint omits `image_base64`; get-by-oid includes `image_base64`

### Notification Child (`campaigns.notifications`)
- `oid`, `notification_batch_oid`, `receiver_stable_id`, `receiver_oid`, `content_blocks`, `status`, `scheduled_at`, `error_message`, `created_at`, `updated_at`
- `status`: `created | sent | failed | cancelled`
- child rows do not store image fields; image send behavior is driven by parent batch fields

### Survey Batch Parent (`campaigns.survey_batchs`)
- `oid`, `name`, `status`, `creator_account`, `total_count`, `image_type`, `image_id`, `image_base64`, `created_at`, `updated_at`
- `status`: `draft | collecting | closed | cancelled`
- image field semantics:
  - `image_type`: image MIME type (`image/*`) for survey banner media
  - `image_id`: reserved external media id field
  - `image_base64`: source image payload for frontend/banner use
- constraints:
  - image fields are parent-level only (not stored on child `surveys` rows)
  - list endpoint omits `image_base64`; get-by-oid includes `image_base64`

### Survey Child (`campaigns.surveys`)
- `oid`, `survey_batch_oid`, `receiver_stable_id`, `receiver_oid`, `survey_questions`, `survey_answer`, `status`, `submitted_at`, `created_at`, `updated_at`
- `status`: `not_started | submitted | revoked | expired`
- `receiver_oid`: NOT NULL — every survey must resolve to a known worker. When creating
  or upserting surveys, if `receiver_oid` is not explicitly provided the server resolves
  it from `receiver_stable_id` via worker lookup. If resolution fails, the endpoint
  returns **422** with detail `Cannot resolve receiver_oid for stable_id: <id>`.
- **Global Registry**: surveys are automatically synced to `registry.global_registry`
  via a database trigger (`object_type='survey'`, `descriptor=receiver_stable_id`).
  This enables discovery via registry search and participation in the edge graph.

## Object APIs

### Notification Batch APIs

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/notification_batchs` | Create notification batch (supports optional parent image fields) | `objects:notification_batchs:write` |
| GET | `/objects/campaigns/notification_batchs` | List notification batches | `objects:notification_batchs:read` |
| GET | `/objects/campaigns/notification_batchs/{notification_batch_oid}` | Get notification batch (includes `image_base64`) | `objects:notification_batchs:read` |
| PUT | `/objects/campaigns/notification_batchs/{notification_batch_oid}` | Update notification batch metadata and optional parent image fields | `objects:notification_batchs:write` |
| POST | `/objects/campaigns/notification_batchs/{notification_batch_oid}/actions` | Notification batch action (`trigger`/`cancel`), with sync image precheck for trigger | `objects:notification_batchs:write` |
| DELETE | `/objects/campaigns/notification_batchs/{notification_batch_oid}` | Delete notification batch | `objects:notification_batchs:write` |

Notification action request example:
```json
{ "action": "trigger" }
```

#### Notification Trigger Behavior Contract
When action is `trigger`, backend behavior is:
1. Validate batch status and channel rules.
2. For `wecom_bot` only, if `image_base64` is present and `image_id` is missing:
   - call external `upload_image` synchronously before DAG trigger,
   - on success persist returned `media_id` into `image_id`,
   - on failure return immediate API error with detail and do **not** trigger DAG.
3. Claim batch into running state.
4. Trigger notification DAG asynchronously for row-level send execution.
5. DAG row dispatch uses UTC due-time gating:
   - send only rows with `status in ('created','failed')` where `scheduled_at` is `null` or `scheduled_at <= now_utc`.
   - rows with future `scheduled_at` are deferred to later runs.
6. Deferred rows are not mutated by that run:
   - keep existing `status`.
   - keep existing `updated_at`.
7. Final batch status is derived from DB child status counts:
   - if any `created` or `failed` rows remain, final status is `partially_completed`.
   - final status is `completed` only when no `created`/`failed` rows remain (`cancelled` rows do not block completion).

`wecom_ops_bot` does not support image send flow. If image fields are populated on
an ops-bot batch, trigger request is rejected.

### Notification Child APIs

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications` | Create one notification row | `objects:notification_batchs:write` |
| POST | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications/batch-upsert` | Upsert notification rows by receiver | `objects:notification_batchs:write` |
| GET | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications` | List notification rows | `objects:notification_batchs:read` |
| GET | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications/{notification_oid}` | Get one notification row | `objects:notification_batchs:read` |
| PUT | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications/{notification_oid}` | Update one notification row metadata only | `objects:notification_batchs:write` |
| DELETE | `/objects/campaigns/notification_batchs/{notification_batch_oid}/notifications/{notification_oid}` | Delete one notification row | `objects:notification_batchs:write` |

Notification child APIs remain text/content-block focused. Image fields are not part
of notification child request/response schemas.

### Survey Batch APIs

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/survey_batchs` | Create survey batch (supports optional parent image fields) | `objects:survey_batchs:write` |
| GET | `/objects/campaigns/survey_batchs` | List survey batches | `objects:survey_batchs:read` |
| GET | `/objects/campaigns/survey_batchs/{survey_batch_oid}` | Get survey batch (includes `image_base64`) | `objects:survey_batchs:read` |
| PUT | `/objects/campaigns/survey_batchs/{survey_batch_oid}` | Update survey batch metadata and optional parent image fields | `objects:survey_batchs:write` |
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

#### Survey Banner Guidance
- Survey banner media is read from survey batch parent endpoints:
  - `GET /objects/campaigns/survey_batchs`
  - `GET /objects/campaigns/survey_batchs/{survey_batch_oid}`
- Survey child/detail APIs are unchanged and do not carry parent banner image fields.

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

## External Dependency: Notification Media Actions (`POST /services`)
Campaign trigger flow depends on external media actions served via:
- Method: `POST`
- Path: `/services`
- Headers:
  - `Authorization: Bearer <fastapi.api_token>`
  - `Content-Type: application/json`

### Upload API (`action=upload_image`)
Request:
```json
{
  "domain": "notification",
  "action": "upload_image",
  "parameters": {
    "provider": "wecom",
    "image_base64": "<base64_or_data_url>",
    "file_name": "image.png",
    "content_type": "image/png"
  }
}
```

Success response:
```json
{
  "status": "success",
  "message": "Image uploaded",
  "data": {
    "provider": "wecom",
    "media_id": "3xxxxxxxx",
    "media_type": "image",
    "created_at": "1730000000",
    "file_name": "image.png",
    "content_type": "image/png",
    "size_bytes": 10240,
    "provider_data": {
      "errcode": 0,
      "errmsg": "ok",
      "type": "image",
      "media_id": "3xxxxxxxx",
      "created_at": "1730000000"
    }
  }
}
```

### Post API (`action=post_bot_image`)
Request:
```json
{
  "domain": "notification",
  "action": "post_bot_image",
  "parameters": {
    "provider": "wecom",
    "user_id": "byjackchen",
    "media_id": "3xxxxxxxx"
  }
}
```

Success response:
```json
{
  "status": "success",
  "message": "Bot image sent",
  "data": {
    "provider": "wecom",
    "receiver": "byjackchen",
    "media_id": "3xxxxxxxx",
    "media_type": "image"
  }
}
```

### Common Error Shape (Both APIs)
```json
{
  "status": "error",
  "message": "<error detail>"
}
```

Compatibility note:
- `action=post_bot_media` is unsupported and must not be used.

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
