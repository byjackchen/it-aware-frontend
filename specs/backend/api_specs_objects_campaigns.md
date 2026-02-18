# Campaigns Module API Specifications

## Overview

Campaigns domain currently includes two object types: **notification** and **survey**.

- Main object table: `campaigns.notifications`
- Detail table: `campaigns.notification_details`
- Detail identity key: `(notification_oid, receiver_stable_id)`
- Main object table: `campaigns.surveys`
- Detail table: `campaigns.survey_details`
- Detail identity key: `(survey_oid, receiver_stable_id)`

## Security Model

All endpoints require authentication.

| Resource | Read Permission | Write Permission |
|----------|-----------------|------------------|
| Notifications | `objects:notifications:read` | `objects:notifications:write` |
| Surveys | `objects:surveys:read` | `objects:surveys:write` |

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

## Notification Derived Summary Rules

`total_count` is recomputed from detail row count after detail mutations.

`status` (non-cancelled) is derived from detail status distribution:
- all `created` -> `created`
- mixed with at least one `created` and at least one processed (`sent`/`failed`) -> `partial`
- all `sent` -> `completed`
- no `created` and at least one `failed` -> `completed_with_failures`

`cancelled` is terminal and treated as immutable for detail writes.

## Data Models (Survey)

### Survey (Main)

```python
class Survey(Base):
    __tablename__ = "surveys"
    __table_args__ = {"schema": "campaigns"}

    oid = Column(BYTEA(16), primary_key=True)
    name = Column(Text, nullable=False)
    status = Column(Text, nullable=False, server_default="created")
    survey_questions = Column(JSONB, nullable=False)  # JSON object: {intro, questions}
    creator_account = Column(Text, nullable=True)
    total_count = Column(Integer, nullable=False, server_default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

`status` enum:
- `created`
- `partial`
- `completed`
- `cancelled`

### Survey Detail (Row)

```python
class SurveyDetail(Base):
    __tablename__ = "survey_details"
    __table_args__ = {"schema": "campaigns"}

    survey_oid = Column(BYTEA(16), ForeignKey("campaigns.surveys.oid", ondelete="CASCADE"), primary_key=True)
    receiver_stable_id = Column(Text, primary_key=True)
    receiver_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), nullable=True)
    survey_answer = Column(JSONB, nullable=True)  # JSON object: {answers}
    status = Column(Text, nullable=False, server_default="created")
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
```

`status` enum:
- `created`
- `submitted`

Rules:
- `receiver_stable_id` must be unique within one survey (`(survey_oid, receiver_stable_id)` PK)
- `status='submitted'` requires non-null `survey_answer` and `submitted_at`
- `status='created'` requires both `survey_answer` and `submitted_at` to be null

## API: Surveys (`/objects/campaigns/surveys`)

### Schemas

```python
class SurveyCreate(BaseModel):
    name: str
    survey_questions: SurveyQuestions
    details: Optional[List[SurveyDetailCreate]] = None

class SurveyUpdate(BaseModel):
    name: Optional[str] = None
    survey_questions: Optional[SurveyQuestions] = None
    status: Optional[Literal["cancelled"]] = None

class SurveyResponse(BaseModel):
    oid: str
    name: str
    status: Literal["created", "partial", "completed", "cancelled"]
    survey_questions: Dict[str, Any]
    creator_account: Optional[str]
    total_count: int
    created_at: datetime
    updated_at: datetime
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/surveys` | Create survey | `objects:surveys:write` |
| GET | `/objects/campaigns/surveys` | List surveys | `objects:surveys:read` |
| GET | `/objects/campaigns/surveys/{survey_oid}` | Get survey | `objects:surveys:read` |
| PUT | `/objects/campaigns/surveys/{survey_oid}` | Update survey | `objects:surveys:write` |
| DELETE | `/objects/campaigns/surveys/{survey_oid}` | Delete survey | `objects:surveys:write` |

List query parameters:
- `status`
- `skip`, `limit`

Update rules:
- `survey_questions` can only change while survey status is `created`; otherwise `409`.
- Manual status update only supports `cancelled`.

## Survey Question Contract (`survey_questions`)

`survey_questions` is a JSON object:

```json
{
  "intro": "plain text intro",
  "questions": [
    {
      "question_id": "q1",
      "type": "single_select",
      "title": "How satisfied are you?",
      "required": true,
      "options": [
        { "option_id": "a", "label": "Good" },
        { "option_id": "b", "label": "Bad" }
      ]
    }
  ]
}
```

Rules:
- `intro` is required plain text and cannot be empty after trim.
- `questions` must contain unique `question_id`.
- Supported types:
  - `single_select`
  - `multi_select`
  - `text`

## Survey Answer Contract (`survey_answer`)

`survey_answer` is a JSON object:

```json
{
  "answers": [
    { "question_id": "q1", "type": "single_select", "selected_option_id": "a" },
    { "question_id": "q2", "type": "multi_select", "selected_option_ids": ["x", "y"] },
    { "question_id": "q3", "type": "text", "text": "free-form answer" }
  ]
}
```

Validation rules:
- `answers` must contain unique `question_id`.
- required questions must be answered on submit.
- answer type must match question type.
- selected option IDs must exist in question options.

## API: Survey Details (`/objects/campaigns/surveys/{survey_oid}/details`)

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/campaigns/surveys/{survey_oid}/details` | Create one detail | `objects:surveys:write` |
| POST | `/objects/campaigns/surveys/{survey_oid}/details/batch-upsert` | Upsert details by receiver | `objects:surveys:write` |
| GET | `/objects/campaigns/surveys/{survey_oid}/details` | List details | `objects:surveys:read` |
| GET | `/objects/campaigns/surveys/{survey_oid}/details/{receiver_stable_id}` | Get one detail | `objects:surveys:read` |
| PUT | `/objects/campaigns/surveys/{survey_oid}/details/{receiver_stable_id}` | Update one detail | `objects:surveys:write` |
| DELETE | `/objects/campaigns/surveys/{survey_oid}/details/{receiver_stable_id}` | Delete one detail | `objects:surveys:write` |

Detail list query parameters:
- `status`
- `receiver_stable_id`
- `submitted_at_from`
- `submitted_at_to`
- `skip`, `limit`

## API: Campaign Services (Survey Receiver)

### Receiver Read
- `GET /services/campaigns/surveys/{survey_oid}/receiver/{receiver_stable_id}`
- Returns survey questions and the receiver's answer/status snapshot.

### Receiver Operations
- `POST /services/campaigns/surveys/{survey_oid}/receiver/{receiver_stable_id}`

Request:
```json
{
  "operation": "submit",
  "survey_answer": {
    "answers": [
      { "question_id": "q1", "type": "single_select", "selected_option_id": "a" }
    ]
  }
}
```

Supported operations:
- `submit`:
  - allowed only when detail status is `created`; otherwise `409`
  - validates `survey_answer` against `survey_questions`
  - sets detail status to `submitted`
- `revoke`:
  - allowed only when detail status is `submitted`; otherwise `409`
  - resets detail status to `created`
  - clears `survey_answer` and `submitted_at`

## Survey Derived Summary Rules

`total_count` is recomputed from detail row count after detail mutations.

`status` (non-cancelled) is derived from detail status distribution:
- all `created` -> `created`
- mixed `created` and `submitted` -> `partial`
- all `submitted` -> `completed`

`cancelled` is terminal and treated as immutable for detail writes.
