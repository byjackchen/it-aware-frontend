# Campaigns Module API Specifications

## Overview

Campaigns domain currently includes one object type: **notification**.

- Main object table: `campaigns.notifications`
- Detail table: `campaigns.notification_details`
- Detail identity key: `(notification_oid, receiver_stable_id)`

## Security Model

All endpoints require authentication.

| Resource | Read Permission | Write Permission |
|----------|-----------------|------------------|
| Notifications | `objects:notifications:read` | `objects:notifications:write` |

## Data Models

### Notification (Main)

```python
class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = {"schema": "campaigns"}

    oid = Column(BYTEA(16), primary_key=True)
    name = Column(Text, nullable=False)
    channel = Column(Text, nullable=False, server_default="wecom_bot")
    status = Column(Text, nullable=False, server_default="created")
    run_id = Column(Text, nullable=True)  # latest services DAG run id
    creator_account = Column(Text, nullable=True)  # stamped account_id from create caller
    total_count = Column(Integer, nullable=False, server_default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

`channel` enum:
- `wecom_bot`
- `wecom_ops_bot`

`status` enum:
- `created`
- `processing`
- `partial`
- `completed`
- `completed_with_failures`
- `cancelled`

### Notification Detail (Row)

```python
class NotificationDetail(Base):
    __tablename__ = "notification_details"
    __table_args__ = {"schema": "campaigns"}

    notification_oid = Column(BYTEA(16), ForeignKey("campaigns.notifications.oid", ondelete="CASCADE"), primary_key=True)
    receiver_stable_id = Column(Text, primary_key=True)
    receiver_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), nullable=True)
    content_blocks = Column(JSONB, nullable=False)
    status = Column(Text, nullable=False, server_default="created")
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

`status` enum:
- `created`
- `sent`
- `failed`

Rules:
- `receiver_stable_id` must be unique within one notification (`(notification_oid, receiver_stable_id)` PK)
- `status='failed'` requires non-empty `error_message`
- `content_blocks` must be JSON array

## API: Notifications (`/objects/campaigns/notifications`)

### Schemas

```python
class NotificationCreate(BaseModel):
    name: str
    channel: Literal["wecom_bot", "wecom_ops_bot"] = "wecom_bot"
    details: Optional[List[NotificationDetailCreate]] = None

class NotificationUpdate(BaseModel):
    name: Optional[str] = None
    channel: Optional[Literal["wecom_bot", "wecom_ops_bot"]] = None
    status: Optional[Literal["processing", "cancelled"]] = None

class NotificationResponse(BaseModel):
    oid: str
    name: str
    channel: Literal["wecom_bot", "wecom_ops_bot"]
    status: Literal["created", "processing", "partial", "completed", "completed_with_failures", "cancelled"]
    run_id: Optional[str]
    creator_account: Optional[str]
    total_count: int
    created_at: datetime
    updated_at: datetime

class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    total: int
    skip: int
    limit: int
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/notifications` | Create notification | `objects:notifications:write` |
| GET | `/objects/campaigns/notifications` | List notifications | `objects:notifications:read` |
| GET | `/objects/campaigns/notifications/{notification_oid}` | Get notification | `objects:notifications:read` |
| PUT | `/objects/campaigns/notifications/{notification_oid}` | Update notification | `objects:notifications:write` |
| DELETE | `/objects/campaigns/notifications/{notification_oid}` | Delete notification | `objects:notifications:write` |

List query parameters:
- `status` (exact enum filter)
- `channel` (`wecom_bot` / `wecom_ops_bot`)
- `skip`, `limit`

Update rule:
- `channel` can only change while notification status is `created`; otherwise `409`.

> **List response shape**: `GET /objects/campaigns/notifications` returns `NotificationListResponse` (`{ items, total, skip, limit }`), consistent with other object list contracts (for example incidents).
>
> **Pagination stability**: ordering is `created_at DESC`, tie-breaker `oid DESC`.

Example response (`GET /objects/campaigns/notifications?channel=wecom_bot&skip=0&limit=2`):

```json
{
  "items": [
    {
      "oid": "01JXYZ...",
      "name": "weekly_ops_notice",
      "channel": "wecom_bot",
      "status": "created",
      "run_id": null,
      "creator_account": "byjackchen",
      "total_count": 2,
      "created_at": "2026-02-17T10:00:00Z",
      "updated_at": "2026-02-17T10:00:00Z"
    }
  ],
  "total": 1,
  "skip": 0,
  "limit": 2
}
```

## API: Campaign Services (`/services/campaigns`)

### Trigger Notification (Non-Block)

Method and path:
- `POST /services/campaigns/trigger_notification_non-block`

Request:
```json
{
  "notification_oid": "..."
}
```

Response (`202`):
```json
{
  "notification_oid": "...",
  "status": "processing",
  "to_process_count": 12,
  "run_id": "manual__trigger_notification__..."
}
```

Rules:
- Requires `objects:notifications:write`.
- Only accepts notification in `created`; otherwise `409`.
- On accepted trigger:
  - notification flips to `processing`
  - `run_id` is persisted on notification row
  - Airflow DAG `services_trigger_notification` is triggered asynchronously
- If Airflow trigger fails, backend rolls notification back to `created` and returns `503`.

## API: Notification Details (`/objects/campaigns/notifications/{notification_oid}/details`)

### Schemas

```python
class NotificationDetailCreate(BaseModel):
    receiver_stable_id: str
    content_blocks: List[ContentBlock]
    status: Literal["created", "sent", "failed"] = "created"
    scheduled_at: Optional[datetime] = None
    error_message: Optional[str] = None

class NotificationDetailUpdate(BaseModel):
    content_blocks: Optional[List[ContentBlock]] = None
    status: Optional[Literal["created", "sent", "failed"]] = None
    scheduled_at: Optional[datetime] = None
    error_message: Optional[str] = None

class NotificationDetailResponse(BaseModel):
    notification_oid: str
    receiver_stable_id: str
    receiver_oid: Optional[str]
    content_blocks: List[Dict[str, Any]]
    status: Literal["created", "sent", "failed"]
    scheduled_at: Optional[datetime]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

class NotificationDetailListResponse(BaseModel):
    items: List[NotificationDetailResponse]
    total: int
    skip: int
    limit: int
```

### `content_blocks` contract

Discriminated union by `type`:
- `text`: `{ "type": "text", "text": "..." }` (plain text only)
- `link`: `{ "type": "link", "text": "...", "url": "https://..." }`
- `title`: `{ "type": "title", "text": "..." }`

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/notifications/{notification_oid}/details` | Create one detail | `objects:notifications:write` |
| POST | `/objects/campaigns/notifications/{notification_oid}/details/batch-upsert` | Upsert details by receiver | `objects:notifications:write` |
| GET | `/objects/campaigns/notifications/{notification_oid}/details` | List details | `objects:notifications:read` |
| GET | `/objects/campaigns/notifications/{notification_oid}/details/{receiver_stable_id}` | Get one detail | `objects:notifications:read` |
| PUT | `/objects/campaigns/notifications/{notification_oid}/details/{receiver_stable_id}` | Update one detail | `objects:notifications:write` |
| DELETE | `/objects/campaigns/notifications/{notification_oid}/details/{receiver_stable_id}` | Delete one detail | `objects:notifications:write` |

Detail list query parameters:
- `status`
- `receiver_stable_id`
- `scheduled_at_from`
- `scheduled_at_to`
- `skip`, `limit`

> **List response shape**: `GET /objects/campaigns/notifications/{notification_oid}/details` returns `NotificationDetailListResponse` (`{ items, total, skip, limit }`).
>
> **Pagination stability**: ordering is `updated_at DESC`, tie-breaker `receiver_stable_id ASC`.

Example response (`GET /objects/campaigns/notifications/{notification_oid}/details?skip=0&limit=2`):

```json
{
  "items": [
    {
      "notification_oid": "01JXYZ...",
      "receiver_stable_id": "alice_wxid",
      "receiver_oid": "01JABC...",
      "content_blocks": [
        { "type": "title", "text": "Ops notice" },
        { "type": "text", "text": "Please check incident bridge." }
      ],
      "status": "created",
      "scheduled_at": null,
      "error_message": null,
      "created_at": "2026-02-17T10:00:01Z",
      "updated_at": "2026-02-17T10:00:01Z"
    }
  ],
  "total": 1,
  "skip": 0,
  "limit": 2
}
```

## Derived Summary Rules

`total_count` is recomputed from detail row count after detail mutations.

`status` (non-cancelled) is derived from detail status distribution:
- all `created` -> `created`
- mixed with at least one `created` and at least one processed (`sent`/`failed`) -> `partial`
- all `sent` -> `completed`
- no `created` and at least one `failed` -> `completed_with_failures`

`cancelled` is terminal and treated as immutable for detail writes.
