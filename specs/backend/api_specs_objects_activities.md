# Activity Objects API Specifications

## Overview

Activity objects represent events and interaction aggregates in the system.

- `incident` and `inquiry` inherit from `activities.bases` and share base actor/fact/timestamp fields.
- `interaction` is stored in `activities.interactions` as an independent event table (it does **not** inherit from `activities.bases`).
- Base-backed activity records are synchronized to the **Global Registry** for searchability.

### Module Structure

```
/objects/
├── /activities
│   ├── /incident            - Incident management
│   ├── /inquiry             - Inquiry management
│   └── /interaction         - Interaction events and assignment state
```

## Security Model

All endpoints require authentication. Permissions follow the `{domain}:{resource}:{action}` pattern.

| Resource | Read Permission | Write Permission |
|----------|-----------------|------------------|
| Incidents | `objects:incidents:read` | `objects:incidents:write` |
| Inquiries | `objects:inquiries:read` | `objects:inquiries:write` |
| Interactions | `objects:interactions:read` | `objects:interactions:write` |

**Note:** `incident` and `inquiry` endpoints use ABAC (anchored on actor worker org). `interaction` endpoints currently enforce permission checks without per-row ABAC filtering.

---

## Data Models

### Activity (Base)

```python
class Activity(Base):
    __tablename__ = "bases"
    __table_args__ = {"schema": "activities"}

    oid = Column(BYTEA(16), primary_key=True)
    object_type = Column(Text, nullable=False)
    
    # Actor (Who performed the activity)
    actor_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), nullable=False)
    actor_role = Column(Text, nullable=False) # e.g., "caller", "user"
    
    # AI/Search context
    fact = Column(Text, nullable=True) # Text embedding source
    source_system = Column(Text, nullable=True)
    fact_embedding_id = Column(Text, nullable=True)
    fact_embedded_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
    effective_at = Column(DateTime(timezone=True), server_default=func.now())
```

### Incident

```python
class Incident(Base):
    __tablename__ = "incidents"
    __table_args__ = {"schema": "activities"}

    oid = Column(BYTEA(16), ForeignKey("activities.bases.oid", ondelete="CASCADE"), primary_key=True)
    stable_id = Column(Text, unique=True, nullable=False)
    channel = Column(Text, nullable=True)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    state = Column(Text, nullable=False)
    priority = Column(Text, nullable=True)
    urgency = Column(Text, nullable=True)
    
    assigned_to_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), nullable=True)
    service_catalog_oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid"), nullable=True)
    assigned_group = Column(Text, nullable=True)
    configuration_item_oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid"), nullable=True)
    chat_transcripts = Column(JSONB, nullable=True)
```

### Inquiry

```python
class Inquiry(Base):
    __tablename__ = "inquiries"
    __table_args__ = {"schema": "activities"}

    oid = Column(BYTEA(16), ForeignKey("activities.bases.oid", ondelete="CASCADE"), primary_key=True)
    messages = Column(JSONB, nullable=True) # List of message dicts
    topic = Column(Text, nullable=True)
    state = Column(Text, nullable=False)
```

---

## API 1: Incidents (`/objects/activities/incidents`)

Incidents represent service disruptions or outages.

### Schemas

```python
class IncidentCreate(BaseModel):
    stable_id: Optional[str] = None
    actor_oid: str
    actor_role: Optional[str] = None  # Defaults to "caller"
    title: str
    description: Optional[str] = None
    fact: Optional[str] = None
    priority: Optional[str] = None
    urgency: Optional[str] = None
    channel: Optional[str] = None
    assigned_to_oid: Optional[str] = None
    service_catalog_oid: Optional[str] = None
    configuration_item_oid: Optional[str] = None
    assigned_group: Optional[str] = None
    chat_transcripts: Optional[Dict[str, Any]] = None
    source_system: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    effective_at: Optional[datetime] = None

class IncidentUpdate(BaseModel):
    stable_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    state: Optional[str] = None
    fact: Optional[str] = None
    priority: Optional[str] = None
    urgency: Optional[str] = None
    channel: Optional[str] = None
    assigned_to_oid: Optional[str] = None
    service_catalog_oid: Optional[str] = None
    configuration_item_oid: Optional[str] = None
    assigned_group: Optional[str] = None
    chat_transcripts: Optional[Dict[str, Any]] = None
    source_system: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    effective_at: Optional[datetime] = None

class IncidentResponse(BaseModel):
    oid: str
    stable_id: str
    object_type: str = "incident"
    title: str
    description: Optional[str]
    state: str
    priority: Optional[str]
    urgency: Optional[str]
    channel: Optional[str]
    
    # Relationships
    actor_oid: str
    actor_role: str
    fact: Optional[str]
    source_system: Optional[str]
    fact_embedding_id: Optional[str]
    fact_embedded_at: Optional[datetime]
    assigned_to_oid: Optional[str]
    service_catalog_oid: Optional[str]
    configuration_item_oid: Optional[str]
    assigned_group: Optional[str]
    chat_transcripts: Optional[Dict[str, Any]]
    
    created_at: datetime
    updated_at: datetime
    effective_at: datetime

class IncidentListResponse(BaseModel):
    items: List[IncidentResponse]
    total: int
    skip: int
    limit: int
```

> **Timestamp behavior**: `created_at`, `updated_at`, and `effective_at` should be timezone-aware ISO8601 (e.g., `2026-02-02T12:34:56Z`). Naive timestamps are assumed to be UTC and are normalized to UTC. If omitted, defaults are used on create and existing values are preserved on update.

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/activities/incidents` | Create incident | `objects:incidents:write` |
| GET | `/objects/activities/incidents` | List incidents (ABAC) | `objects:incidents:read` |
| GET | `/objects/activities/incidents/{oid}` | Get incident (ABAC) | `objects:incidents:read` |
| PUT | `/objects/activities/incidents/{oid}` | Update incident | `objects:incidents:write` |
| DELETE | `/objects/activities/incidents/{oid}` | Delete incident | `objects:incidents:write` |

> **Note on Registry Sync**: Registry descriptors are managed internally; `fact` updates trigger embedding refreshes.
>
> **List response shape**: `GET /objects/activities/incidents` returns `IncidentListResponse` (not a bare array), so callers can read `total` before loading all pages.
>
> **Pagination stability**: default ordering is `created_at DESC`, with secondary tie-breaker `oid DESC` to keep `skip/limit` deterministic.

### ABAC Filtering

- **Unconstrained**: Sees all incidents.
- **Worker Organization**: See incidents where the **Actor** (Creator) belongs to an organization within the user's assigned hierarchy roles.

---

## API 2: Inquiries (`/objects/activities/inquiries`)

Inquiries represent aggregation containers for related interactions of one actor
over a time window. The physical storage remains unchanged:
`activities.bases (object_type='inquiry') + activities.inquiries`.

### Schemas

```python
class InquiryCreate(BaseModel):
    actor_oid: str
    actor_role: Optional[str] = None  # Defaults to "user"
    topic: Optional[str] = None
    messages: Optional[List[Dict[str, Any]]] = None
    fact: Optional[str] = None
    source_system: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    effective_at: Optional[datetime] = None

class InquiryUpdate(BaseModel):
    topic: Optional[str] = None
    messages: Optional[List[Dict[str, Any]]] = None
    state: Optional[str] = None
    fact: Optional[str] = None
    source_system: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    effective_at: Optional[datetime] = None

class InquiryResponse(BaseModel):
    oid: str
    object_type: str = "inquiry"
    topic: Optional[str]
    messages: Optional[List[Dict[str, Any]]]
    state: str
    
    # Relationships
    actor_oid: str
    actor_role: str
    fact: Optional[str]
    source_system: Optional[str]
    fact_embedding_id: Optional[str]
    fact_embedded_at: Optional[datetime]
    
    created_at: datetime
    updated_at: datetime
    effective_at: datetime

class InquiryListResponse(BaseModel):
    items: List[InquiryResponse]
    total: int
    skip: int
    limit: int

class InquiryInteractionItem(BaseModel):
    oid: Optional[str] = None
    stable_id: Optional[str] = None
    source_system: Optional[str] = None
    actor_stable_id: Optional[str] = None
    action_type: Optional[str] = None
    content_text: Optional[str] = None
    content_raw: Optional[Dict[str, Any]] = None
    response_text: Optional[str] = None
    response_raw: Optional[Dict[str, Any]] = None
    assignment_status: Optional[str] = None
    assignment_log: Optional[Dict[str, Any]] = None
    assignment_updated_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    ingested_at: Optional[datetime] = None

class InquiryMaterializeResponse(BaseModel):
    status: str
    changed: bool
    inquiry_oid: str
    updated_fields: List[str]
    llm_used: bool
    fallback_reason: Optional[str]
```

> **Timestamp behavior**: `created_at`, `updated_at`, and `effective_at` should be timezone-aware ISO8601 (e.g., `2026-02-02T12:34:56Z`). Naive timestamps are assumed to be UTC and are normalized to UTC. If omitted, defaults are used on create and existing values are preserved on update.
>
> **Field validation behavior**:
> - `actor_oid` must be a non-empty OID string.
> - Optional text fields are trimmed; blank strings normalize to `null`.
> - `messages` must be a list of JSON objects.
> - `state` (when provided on update) must be non-empty.

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/activities/inquiries` | Create inquiry | `objects:inquiries:write` |
| GET | `/objects/activities/inquiries` | List inquiries (ABAC) | `objects:inquiries:read` |
| GET | `/objects/activities/inquiries/{oid}` | Get inquiry (ABAC) | `objects:inquiries:read` |
| PUT | `/objects/activities/inquiries/{oid}` | Update inquiry | `objects:inquiries:write` |
| DELETE | `/objects/activities/inquiries/{oid}` | Delete inquiry | `objects:inquiries:write` |
| GET | `/objects/activities/inquiries/{oid}/interactions` | List interactions assigned to inquiry (ABAC) | `objects:inquiries:read` |
| POST | `/objects/activities/inquiries/{oid}/materialize` | Rebuild inquiry aggregate (`topic/messages/fact`) from assigned interactions | `objects:inquiries:write` |

> **Note on Registry Sync**: Registry descriptors are managed internally; `fact` updates trigger embedding refreshes.
>
> **List response shape**: `GET /objects/activities/inquiries` returns `InquiryListResponse` (not a bare array), so callers can read `total` before loading all pages.
>
> **Pagination stability**: default ordering is `created_at DESC`, with secondary tie-breaker `oid DESC` to keep `skip/limit` deterministic.
>
> **Task 1 compatibility note**: before the interactions table is introduced (Task 2),
> `/interactions` is expected to return `200` with an empty list.
>
> **Materialize behavior**:
> - Missing inquiry returns `404`.
> - Inquiry access is checked by ABAC write scope (same access rule as inquiry update/delete).
> - No assigned interactions returns `{status: "noop", changed: false, ...}`.
> - Repeated calls with unchanged assigned-interaction projection are idempotent (`changed=false`).
> - When interactions exist, materialize attempts LLM generation for `topic/fact`; if LLM output is invalid or unavailable, deterministic projection is used and `status` becomes `materialized_with_fallback`.
> - If embedding backend is temporarily unavailable, materialize still updates raw `fact` text (best effort) and does not fail solely due to embedding connectivity.

### ABAC Filtering

Same as Incidents (Anchored on **Actor**).

---

## API 3: Interactions (`/objects/activities/interactions`)

Interactions are atomic source events stored independently in
`activities.interactions` (they do not inherit from `activities.bases`).

### Schemas

```python
class InteractionBatchUpsertRequest(BaseModel):
    run_id: Optional[str] = None
    batch_id: Optional[str] = None
    interactions: List[InteractionUpsertItem]  # 1..500, unique stable_id per request

class InteractionUpsertItem(BaseModel):
    stable_id: str
    source_system: str
    actor_stable_id: str
    action_type: Literal["enter", "click", "send_msg"]
    content_text: Optional[str] = None
    content_raw: Optional[Dict[str, Any]] = None
    response_text: Optional[str] = None
    response_raw: Optional[Dict[str, Any]] = None
    created_at: datetime
    ingested_at: Optional[datetime] = None

class InteractionBatchAssignRequest(BaseModel):
    run_id: Optional[str] = None
    batch_id: Optional[str] = None
    assignments: List[InteractionAssignItem]  # 1..500, unique stable_id per request

class InteractionAssignItem(BaseModel):
    stable_id: str
    assignment_status: Optional[Literal["assigned", "deferred"]] = None  # null allowed (clear assignment)
    assigned_inquiry_oid: Optional[str] = None
    assignment_log: Optional[Dict[str, Any]] = None
    assignment_updated_at: Optional[datetime] = None

class InteractionBatchDecideAssignmentRequest(BaseModel):
    actor_stable_id: str
    run_id: str
    batch_id: str
    dry_run: bool = False
    prompt_version: str = "v1"
    model: str = "DeepSeek-V3_2-Online-32k"
    candidate_inquiries: List[CandidateInquiryInput] = []
    interaction_stable_ids: List[str]  # 1..500, unique stable_id per request

class CandidateInquiryInput(BaseModel):
    inquiry_oid: str  # OID string
    summary: Optional[str] = None
    state: Optional[str] = None
    last_event_ts: Optional[datetime] = None

class InteractionBatchDecideAssignmentResponse(BaseModel):
    decisions: List[InteractionAssignmentDecisionItem]
    decision_summary: InteractionDecisionSummary
    write_summary: InteractionDecisionWriteSummary
    affected_inquiry_oids: List[str]
    parser_fallback_count: int
    model_meta: InteractionDecisionModelMeta
    dry_run: bool
    replayed_count: int = 0

class InteractionAssignmentDecisionItem(BaseModel):
    stable_id: str
    action: Literal["attach", "create", "defer"]
    target_inquiry_oid: Optional[str] = None
    reason: str
    confidence: float  # [0, 1]
    parser_status: Literal["ok", "fallback"]
    fallback_reason: Optional[str] = None

class InteractionDecisionSummary(BaseModel):
    attach: int
    create: int
    defer: int

class InteractionDecisionWriteSummary(BaseModel):
    updated_count: int
    unchanged_count: int
    assigned_count: int
    deferred_count: int
    created_inquiry_count: int

class InteractionDecisionModelMeta(BaseModel):
    provider: str
    model: str
    prompt_version: str
    request_id: Optional[str] = None
    latency_ms: int

class InteractionResponse(BaseModel):
    oid: str
    stable_id: str
    object_type: str = "interaction"
    source_system: str
    actor_stable_id: str
    action_type: Literal["enter", "click", "send_msg"]
    content_text: Optional[str]
    content_raw: Optional[Dict[str, Any]]
    response_text: Optional[str]
    response_raw: Optional[Dict[str, Any]]
    assignment_status: Optional[Literal["assigned", "deferred"]]
    assigned_inquiry_oid: Optional[str]
    assignment_updated_at: Optional[datetime]
    assignment_log: Optional[Dict[str, Any]]
    created_at: datetime
    ingested_at: datetime
    updated_at: datetime

class InteractionListResponse(BaseModel):
    items: List[InteractionResponse]
    total: int
    skip: int
    limit: int
    sort_by: Literal["created_at", "ingested_at", "updated_at"]
    order: Literal["asc", "desc"]
```

> **Timestamp behavior**: request datetimes are normalized to UTC. Naive timestamps are treated as UTC.
>
> **Batch decide behavior**:
> - This endpoint must call LLM for decision making (`attach/create/defer`), including `dry_run=true`.
> - `dry_run=true`: returns decision payload without DB write.
> - `dry_run=false`: applies decisions directly to DB (including inquiry creation for `create`).
> - Same `run_id + batch_id` replay is idempotent and returns `replayed_count`.
> - Invalid or missing LLM decision items downgrade to `defer` with `parser_status="fallback"`.

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/activities/interactions/batch-upsert` | Batch idempotent upsert by `stable_id` | `objects:interactions:write` |
| POST | `/objects/activities/interactions/batch-assign` | Batch write assignment status/inquiry | `objects:interactions:write` |
| POST | `/objects/activities/interactions/batch-decide-assignment` | LLM batch decide + optional write-through assignment | `objects:interactions:write` |
| GET | `/objects/activities/interactions` | List interactions with filters | `objects:interactions:read` |
| GET | `/objects/activities/interactions/{interaction_oid}` | Get single interaction | `objects:interactions:read` |
| DELETE | `/objects/activities/interactions/{interaction_oid}` | Delete single interaction | `objects:interactions:write` |

> **Access scope note**: unlike incidents/inquiries, interaction list/get APIs are not ABAC-filtered per actor hierarchy today.

### Query Parameters (`GET /objects/activities/interactions`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `stable_id` | string | null | Exact stable id filter |
| `stable_id_prefix` | string | null | Prefix stable id filter |
| `actor_stable_id` | string | null | Actor filter |
| `source_system` | string | null | Source system filter |
| `assignment_status` | `assigned`/`deferred`/`null` | null | Assignment state filter |
| `assigned_inquiry_oid` | string | null | Assigned inquiry OID filter |
| `created_at_from` | ISO8601 datetime | null | Created-at lower bound |
| `created_at_to` | ISO8601 datetime | null | Created-at upper bound |
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |
| `sort_by` | `created_at`/`ingested_at`/`updated_at` | `created_at` | Sort field |
| `order` | `asc`/`desc` | `desc` | Sort direction |

List response now returns `InteractionListResponse` with:
- `items`: current page records
- `total`: total matched records for current filters
- `skip`, `limit`, `sort_by`, `order`: echo of applied pagination/sort options

Default order is `created_at DESC`, with secondary tie-breaker `oid DESC` for stable pagination.

### Error Responses (Common Interaction APIs)

| Status | Condition | Example |
|--------|-----------|---------|
| 404 | Interaction not found / missing stable ids | `{"detail":{"message":"Interactions not found","code":"not_found","missing_stable_ids":[...]}}` |
| 404 | Missing inquiry target/candidate | `{"detail":{"message":"Target inquiry not found","code":"not_found","missing_inquiry_oids":[...]}}` |
| 422 | Invalid OID format or payload validation | `{"detail":{"message":"Validation error","code":"validation_error","errors":[...]}}` |
| 502 | LLM upstream HTTP/API error | `{"detail":{"message":"LLM upstream API error: ...","code":"upstream_error"}}` |
| 503 | LLM timeout/config/service unavailable | `{"detail":{"message":"LLM request timed out","code":"service_unavailable"}}` |
| 500 | Unexpected internal failure | `{"detail":{"message":"batch-decide-assignment failed: ...","code":"internal_error"}}` |

### Constraints and Indexes

- Unique: `stable_id`
- Check: `action_type IN ('enter', 'click', 'send_msg')`
- Check: `assignment_status='assigned'` requires non-null `assigned_inquiry_oid`
- Indexes:
  - `(actor_stable_id, created_at DESC)`
  - `(assignment_status, created_at DESC)`
  - `(assigned_inquiry_oid, created_at DESC)`

## API 4: Activities Embed Search (`/objects/activities/embed_search`)

Searches Hyaide embeddings and returns matching activity base records.

### Schemas

```python
class EmbedSearchRequest(BaseModel):
    query: str

class EmbedSearchResult(BaseModel):
    oid: str
    object_type: str
    actor_oid: str
    actor_role: str
    fact: Optional[str]
    source_system: Optional[str]
    fact_embedding_id: Optional[str]
    fact_embedded_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    effective_at: datetime
    score: Optional[float]

class EmbedSearchResponse(BaseModel):
    results: List[EmbedSearchResult]
    count: int
```

### Endpoint

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/activities/embed_search` | Search activity embeddings | `objects:incidents:read` or `objects:inquiries:read` |

**Notes**
- Search results are ordered by the embedding search ranking.
- Each result is filtered by ABAC rules for its object type (incident vs inquiry).
