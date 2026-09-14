# Activity Objects API Specifications

## Overview

Activity objects represent events and interaction aggregates in the system.

- `incident`, `request`, and `inquiry` inherit from `activities.bases` and share base actor/fact/timestamp fields.
- `interaction` is stored in `activities.interactions` as an independent event table (it does **not** inherit from `activities.bases`).
- Base-backed activity records are synchronized to the **Global Registry** for searchability.

### Module Structure

```
/objects/
├── /activities
│   ├── /incident            - Incident management
│   ├── /request             - Request management
│   ├── /inquiry             - Inquiry management
│   └── /interaction         - Interaction events and assignment state
```

## Security Model

All endpoints require authentication. Permissions follow the `{domain}:{resource}:{action}` pattern.

| Resource | Read Permission | Write Permission |
|----------|-----------------|------------------|
| Incidents | `objects:incidents:read` | `objects:incidents:write` |
| Requests | `objects:requests:read` | `objects:requests:write` |
| Inquiries | `objects:inquiries:read` | `objects:inquiries:write` |
| Interactions | `objects:interactions:read` | `objects:interactions:write` |

**ABAC:** All activity endpoints use ABAC row-level filtering anchored on the actor's worker organization:
- `incident`, `request`, `inquiry`: anchored via `Activity.actor_oid` → `Worker.org_oid` (WORKER_ORG)
- `interaction`: anchored via `Interaction.actor_oid` → `Worker.org_oid` (WORKER_ORG). Interactions with `actor_oid = NULL` (unresolved actor) are only visible to unconstrained users.
- Batch write endpoints (`batch-upsert`, `batch-assign`, `batch-decide-assignment`) are typically called by system accounts with unconstrained scope.

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
    __table_args__ = (
        CheckConstraint(
            "csat_score IS NULL OR csat_score BETWEEN 1 AND 5",
            name="incidents_csat_score_check",
        ),
        # GIN indexes on the SSC dashboard array columns + partial index on review flag
        {"schema": "activities"},
    )

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

    # SSC dashboard — human review overrides (AI summary stays on bases.fact, no new column)
    review_summary = Column(Text, nullable=True)
    review_needs_optimization = Column(Boolean, nullable=True)
    review_optimization_notes = Column(Text, nullable=True)
    review_completed_at = Column(DateTime(timezone=True), nullable=True)
    review_completed_by_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), nullable=True)

    # SSC dashboard — multi-link arrays populated by digest_incidents DAG.
    # NULL = not yet computed; [] = computed but no relevant matches; [oid, ...] = computed with results.
    pre_ticket_interaction_oids = Column(ARRAY(BYTEA(16)), nullable=True)
    related_kb_article_oids = Column(ARRAY(BYTEA(16)), nullable=True)

    # SSC dashboard — CSAT (sourced from external survey pipeline; currently always NULL until wired up)
    csat_score = Column(SmallInteger, nullable=True)
    csat_text = Column(Text, nullable=True)
```

### Request

```python
class Request(Base):
    __tablename__ = "requests"
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
    service_catalog_oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid"), nullable=True)
    configuration_item_oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid"), nullable=True)
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

    # SSC dashboard — review fields (review_completed_* set only via PATCH /review)
    review_summary: Optional[str] = None
    review_needs_optimization: Optional[bool] = None
    review_optimization_notes: Optional[str] = None
    pre_ticket_interaction_oids: Optional[List[str]] = None
    related_kb_article_oids: Optional[List[str]] = None
    csat_score: Optional[int] = None
    csat_text: Optional[str] = None

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

    # SSC dashboard — review (AI summary stays on the inherited `fact` field)
    review_summary: Optional[str] = None
    review_needs_optimization: Optional[bool] = None
    review_optimization_notes: Optional[str] = None
    review_completed_at: Optional[datetime] = None
    review_completed_by_oid: Optional[str] = None  # raw OID; resolve display name via workerMap

    # SSC dashboard — multi-link arrays. NULL = not yet computed by digest_incidents;
    # [] = computed with no matches; [oid, ...] = computed with results.
    pre_ticket_interaction_oids: Optional[List[str]] = None
    related_kb_article_oids: Optional[List[str]] = None

    # SSC dashboard — CSAT
    csat_score: Optional[int] = None
    csat_text: Optional[str] = None

    created_at: datetime
    updated_at: datetime
    effective_at: datetime

class IncidentListResponse(BaseModel):
    items: List[IncidentResponse]
    total: int
    skip: int
    limit: int

class IncidentReviewUpdate(BaseModel):
    """Partial update for SSC dashboard human review fields.

    Distinct from IncidentUpdate: this schema (a) carries `mark_completed`
    semantics that flip review_completed_at + review_completed_by_oid as a unit,
    and (b) requires at least one field to be set.
    """

    review_summary: Optional[str] = None
    review_needs_optimization: Optional[bool] = None
    review_optimization_notes: Optional[str] = None
    csat_score: Optional[int] = None  # validated 1..5
    csat_text: Optional[str] = None
    pre_ticket_interaction_oids: Optional[List[str]] = None  # OID strings, deduped + format-checked
    related_kb_article_oids: Optional[List[str]] = None
    mark_completed: Optional[bool] = None
    # mark_completed semantics:
    #   true   → set review_completed_at = now(), review_completed_by_oid = current worker
    #   false  → clear both fields
    #   None   → leave both fields untouched
    # NOTE: mark_completed=true requires the caller to be a worker-linked account.
    # Service tokens are rejected with HTTP 400.
```

> **Timestamp behavior**: `created_at`, `updated_at`, and `effective_at` should be timezone-aware ISO8601 (e.g., `2026-02-02T12:34:56Z`). Naive timestamps are assumed to be UTC and are normalized to UTC. If omitted, defaults are used on create and existing values are preserved on update.

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/activities/incidents` | Create incident | `objects:incidents:write` |
| GET | `/objects/activities/incidents` | List incidents (ABAC) | `objects:incidents:read` |
| GET | `/objects/activities/incidents/{oid}` | Get incident (ABAC) | `objects:incidents:read` |
| PUT | `/objects/activities/incidents/{oid}` | Update incident | `objects:incidents:write` |
| PATCH | `/objects/activities/incidents/{oid}/review` | Update SSC dashboard human-review fields (incl. `mark_completed`) | `objects:incidents:write` |
| DELETE | `/objects/activities/incidents/{oid}` | Delete incident | `objects:incidents:write` |

> **Note on Registry Sync**: Registry descriptors are managed internally; `fact` updates trigger embedding refreshes.
>
> **List response shape**: `GET /objects/activities/incidents` returns `IncidentListResponse` (not a bare array), so callers can read `total` before loading all pages.
>
> **Pagination stability**: default ordering is `created_at DESC`, with secondary tie-breaker `oid DESC` to keep `skip/limit` deterministic.
>
> **`PATCH /{oid}/review` semantics** (SSC dashboard):
> - Body is `IncidentReviewUpdate`. At least one field must be set.
> - All fields are partial — only fields present in the JSON body are written.
> - `mark_completed=true` sets `review_completed_at = now()` and `review_completed_by_oid = current user's worker_oid`. Requires a worker-linked account; service tokens are rejected with `400`.
> - `mark_completed=false` clears both fields.
> - Omitting `mark_completed` (or sending `null`) leaves the completion state untouched.
> - `csat_score` is validated `1..5`; out-of-range values return `422`.
> - `pre_ticket_interaction_oids` / `related_kb_article_oids` accept OID-string arrays which are deduped and format-validated; pass `[]` to explicitly clear, omit the field to leave untouched.
> - Returns the full `IncidentResponse` after the update.
> - ABAC: enforced via `bases.actor_oid → Worker.org_oid` (WORKER_ORG anchor). Returns `403` if the incident exists but the requester lacks scope, `404` if it doesn't exist.

### Query Parameters (`GET /objects/activities/incidents`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `state` | string | null | Exact state filter |
| `states_list` | string[] | null | Multi-value active-state filter; repeated query params match `state = ANY(states_list)` |
| `priority` | string | null | Exact priority filter |
| `stable_id` | string | null | Exact stable id filter |
| `actor_oid` | OID string | null | Exact actor worker OID filter |
| `assigned_group` | string[] | null | Multi-value assignment-group filter |
| `actor_location_oid` | OID string[] | null | Multi-value caller location filter |
| `actor_org_oid` | OID string[] | null | Multi-value caller organization filter |
| `is_vip` | boolean | null | Join caller worker and filter VIP callers |
| `view` | `full` \| `slim` | `full` | `slim` omits heavy text/review fields and enables short cache + partial-response behavior for dashboard reads |
| `created_at_from` | ISO8601 datetime | null | Created-at lower bound (inclusive) |
| `created_at_to` | ISO8601 datetime | null | Created-at upper bound (inclusive) |
| `updated_at_from` | ISO8601 datetime | null | Updated-at lower bound (inclusive) |
| `updated_at_to` | ISO8601 datetime | null | Updated-at upper bound (inclusive) |
| `effective_at_from` | ISO8601 datetime | null | Effective-at lower bound (inclusive) |
| `effective_at_to` | ISO8601 datetime | null | Effective-at upper bound (inclusive) |
| `source_updated_at_from` | ISO8601 datetime | null | ServiceNow `sys_updated_on` lower bound; preferred aging clock for Ops Dashboard |
| `source_updated_at_to` | ISO8601 datetime | null | ServiceNow `sys_updated_on` upper bound |
| `source_opened_at_from` | ISO8601 datetime | null | ServiceNow opened timestamp lower bound |
| `source_opened_at_to` | ISO8601 datetime | null | ServiceNow opened timestamp upper bound |
| `source_resolved_at_from` | ISO8601 datetime | null | Incident resolved timestamp lower bound |
| `source_resolved_at_to` | ISO8601 datetime | null | Incident resolved timestamp upper bound |
| `made_sla` | boolean | null | Filter by SLA-met incidents |
| `escalation_min` | integer | null | Filter incidents with `COALESCE(escalation, 0) >= escalation_min` |
| `needs_optimization` | boolean | null | SSC dashboard: `true` → only incidents flagged `review_needs_optimization=true`; `false` → only incidents flagged `false`; `null` → no filter (includes both flagged and unset rows) |
| `completed` | boolean | null | SSC dashboard: `true` → only reviews where `review_completed_at IS NOT NULL`; `false` → only reviews where `review_completed_at IS NULL` |
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |

Use `GET /objects/activities/incidents/{oid}` for exact OID lookup.

### `GET /dashboards/itopsdashboard/incident-sla-monthly` — Incident SLA Monthly Report (ITOps Dashboard)

Months-as-rows SLA compliance report for one calendar year, aggregated from `activities.incident_slas` joined to `activities.incidents` (ABAC enforced — same scope as the incidents list endpoint). Permission: `objects:incidents:read`.

Semantics (validated cell-for-cell against the upstream oitops report):

- A **sample** is an `incident_slas` row with `stage = 'Completed'`, bucketed by the **UTC** calendar month of `start_time`.
- **Met** = `has_breached IS FALSE` (`made_sla` is TRUE on every synced row and is not used).
- Columns are classified from `sla_name`: `%response%` → response; `%resolution%` + `%priority N%` → P1–P4. Unmatched names are excluded.
- The 10min/30min/23h/5d/7d thresholds shown in the UI are display labels only — ServiceNow computed the breach verdict against its own schedule.

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `year` | integer | current UTC year | Calendar year (UTC), `>= 2020`, not in the future |

**Response schema:** `IncidentSlaMonthlyReport`

```python
class SlaCell(BaseModel):
    met: int
    total: int
    pct: Optional[float]  # None when total == 0

class SlaMonthRow(BaseModel):
    month: str            # "2026-08"; "2026" for the cumulative row
    is_partial: bool      # True for the current in-progress month
    response: SlaCell
    p1: SlaCell
    p2: SlaCell
    p3: SlaCell
    p4: SlaCell
    resolution_subtotal: SlaCell
    all_sla: SlaCell      # all_sla.total is the row's total sample count

class IncidentSlaMonthlyReport(BaseModel):
    year: int
    months: List[SlaMonthRow]  # Jan..current month (or Dec for past years)
    cumulative: SlaMonthRow
    generated_at: datetime
```

### `GET /dashboards/itopsdashboard/overview` — ITOps Dashboard Overview (海外IT运营看板)

The whole landing page in one payload: 4 domains × 2 metrics, 3 capability cards with their metrics and improvement items, and a `details` map keyed by metric code that backs the metric drawer. No query parameters.

**Permission:** `objects:incidents:read` — the only data on the page that is not static editorial content is incident-derived. There is deliberately **no dedicated dashboard permission**: it would mean a row in `auth.permissions` plus a grant to every group that should see the page, to gate content that carries no access risk of its own.

**No database.** The curated content — domain and capability cards, all 25 metric definitions with thresholds, calculation rules and owners, plus projects, issues, improvement items and the hand-entered weekly values — is a checked-in file, `app/dashboards/itopsdashboard/overview/content.json`, parsed and cached on first use. Nothing writes to it at runtime and nothing else references it, so it is versioned configuration rather than a table; storing it in Postgres would cost a migration, ten tables and a post-deploy seed step and buy nothing. If a weekly editing UI is ever built, `overview/content.py` is the module to replace with real tables.

**ABAC applies to the SLA family only.** `sla`, `overall_sla` and `response_sla` carry a `cumulative` object computed live by `compute_incident_sla_monthly` under the caller's incident scope — the same helper and therefore the same figures as `incident-sla-monthly` for that account. Every other metric is a global hand-entered number with nothing to scope; those omit `cumulative` and fall back to the file's `cumulativeLabel` (「累计值：待接入」), as does a caller whose scope holds no completed SLA rows this year.

```python
class MetricCumulative(BaseModel):   # camelCase on the wire
    pct: float
    total: int
    year: int
```

**camelCase exception.** This is the only endpoint family in the backend emitting camelCase, so the ported React components can read the payload verbatim and stay comparable to the original dashboard. Rationale is in `overview/schemas.py`'s docstring.

**No status field.** Metric/capability health is resolved in the frontend from `value` + `definition`, keeping the threshold rules in one language (`lib/itopsdashboard/domain/status.ts`).

**Not cached in Redis.** The content is already in memory and the one live query is per-caller, so a scope-hashed cache key would add contention for no gain.

### ABAC Filtering

- **Unconstrained**: Sees all incidents.
- **Worker Organization**: See incidents where the **Actor** (Creator) belongs to an organization within the user's assigned hierarchy roles.

---

## API 2: Requests (`/objects/activities/requests`)

Requests represent service request records and follow the same model style as incidents:
`activities.bases (object_type='request') + activities.requests`.

### Schemas

```python
class RequestCreate(BaseModel):
    stable_id: Optional[str] = None
    actor_oid: str
    actor_role: Optional[str] = None  # Defaults to "requester"
    title: str
    description: Optional[str] = None
    state: str
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

class RequestUpdate(BaseModel):
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

class RequestResponse(BaseModel):
    oid: str
    stable_id: str
    object_type: str = "request"
    title: str
    description: Optional[str]
    state: str
    priority: Optional[str]
    urgency: Optional[str]
    channel: Optional[str]

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

class RequestListResponse(BaseModel):
    items: List[RequestResponse]
    total: int
    skip: int
    limit: int
```

> **Create behavior**:
> - `state` is explicitly provided by caller (not forced to `"New"`).
> - `stable_id` remains optional; when omitted, backend auto-generates a UUID string without fixed prefix.

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/activities/requests` | Create request | `objects:requests:write` |
| GET | `/objects/activities/requests` | List requests (ABAC) | `objects:requests:read` |
| GET | `/objects/activities/requests/{oid}` | Get request (ABAC) | `objects:requests:read` |
| PUT | `/objects/activities/requests/{oid}` | Update request | `objects:requests:write` |
| DELETE | `/objects/activities/requests/{oid}` | Delete request | `objects:requests:write` |

### Query Parameters (`GET /objects/activities/requests`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `state` | string | null | Exact state filter |
| `states_list` | string[] | null | Multi-value active-state filter; repeated query params match `state = ANY(states_list)` |
| `priority` | string | null | Exact priority filter |
| `stable_id` | string | null | Exact stable id filter |
| `actor_oid` | OID string | null | Exact actor worker OID filter |
| `assigned_group` | string[] | null | Multi-value assignment-group filter |
| `actor_location_oid` | OID string[] | null | Multi-value requester location filter |
| `actor_org_oid` | OID string[] | null | Multi-value requester organization filter |
| `is_vip` | boolean | null | Join requester worker and filter VIP callers |
| `view` | `full` \| `slim` | `full` | `slim` omits heavy text fields and enables short cache + partial-response behavior for dashboard reads |
| `created_at_from` | ISO8601 datetime | null | Created-at lower bound (inclusive) |
| `created_at_to` | ISO8601 datetime | null | Created-at upper bound (inclusive) |
| `updated_at_from` | ISO8601 datetime | null | Updated-at lower bound (inclusive) |
| `updated_at_to` | ISO8601 datetime | null | Updated-at upper bound (inclusive) |
| `effective_at_from` | ISO8601 datetime | null | Effective-at lower bound (inclusive) |
| `effective_at_to` | ISO8601 datetime | null | Effective-at upper bound (inclusive) |
| `source_updated_at_from` | ISO8601 datetime | null | ServiceNow `sys_updated_on` lower bound; preferred aging clock for Ops Dashboard |
| `source_updated_at_to` | ISO8601 datetime | null | ServiceNow `sys_updated_on` upper bound |
| `source_opened_at_from` | ISO8601 datetime | null | ServiceNow opened timestamp lower bound |
| `source_opened_at_to` | ISO8601 datetime | null | ServiceNow opened timestamp upper bound |
| `source_closed_at_from` | ISO8601 datetime | null | Request closed timestamp lower bound |
| `source_closed_at_to` | ISO8601 datetime | null | Request closed timestamp upper bound |
| `made_sla` | boolean | null | Filter by SLA-met requests when populated |
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |

Use `GET /objects/activities/requests/{oid}` for exact OID lookup.

### ABAC Filtering

Same as Incidents (Anchored on **Actor**).

---

## API 3: Inquiries (`/objects/activities/inquiries`)

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
    service_catalog_oid: Optional[str] = None
    configuration_item_oid: Optional[str] = None
    fact: Optional[str] = None
    source_system: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    effective_at: Optional[datetime] = None

class InquiryUpdate(BaseModel):
    topic: Optional[str] = None
    messages: Optional[List[Dict[str, Any]]] = None
    state: Optional[str] = None
    service_catalog_oid: Optional[str] = None
    configuration_item_oid: Optional[str] = None
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
    service_catalog_oid: Optional[str]
    configuration_item_oid: Optional[str]
    
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
> - `service_catalog_oid` / `configuration_item_oid` accept OID strings; update payload may pass empty string to clear field.

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/activities/inquiries` | Create inquiry | `objects:inquiries:write` |
| GET | `/objects/activities/inquiries` | List inquiries (ABAC) | `objects:inquiries:read` |
| GET | `/objects/activities/inquiries/{oid}` | Get inquiry (ABAC) | `objects:inquiries:read` |
| PUT | `/objects/activities/inquiries/{oid}` | Update inquiry | `objects:inquiries:write` |
| DELETE | `/objects/activities/inquiries/{oid}` | Delete inquiry | `objects:inquiries:write` |
| GET | `/objects/activities/inquiries/{oid}/interactions` | List interactions assigned to inquiry (ABAC) | `objects:inquiries:read` |
| POST | `/objects/activities/inquiries/{oid}/materialize` | Rebuild inquiry aggregate (`topic/messages/fact`) and classify `service_catalog_oid/configuration_item_oid` from assigned interactions | `objects:inquiries:write` |

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
> - No assigned interactions:
>   - if state already `unresolved`, returns `{status: "noop", changed: false, ...}`
>   - otherwise sets state to `unresolved` and returns `changed=true`.
> - Repeated calls with unchanged assigned-interaction projection are idempotent (`changed=false`).
> - When interactions exist, materialize attempts LLM generation for `topic/fact` and categorization fields (`service_catalog_oid/configuration_item_oid`).
> - Inquiry base timestamps are derived from assigned interactions:
>   `created_at=min(interaction.created_at)`, `updated_at=max(interaction.created_at)`,
>   `effective_at=min(interaction.effective_at)`.
> - If LLM output is invalid or unavailable, deterministic projection is used for `topic/fact` and `status` becomes `materialized_with_fallback`.
> - If embedding backend is temporarily unavailable, materialize still updates raw `fact` text (best effort) and does not fail solely due to embedding connectivity.
> - Digest/materialize path writes inquiry `state` as `resolved|unresolved`.
> - Materialized `messages` are digest role-pair entries only: each item is `{"line": "<user>:<text>; <assistant>:<text>"}`.
> - When `interaction.response_text` is empty, assistant text is derived from `interaction.response_raw` (for example `responses[].rendered_text`) before line formatting.

### Query Parameters (`GET /objects/activities/inquiries`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `state` | string | null | Exact/normalized state filter |
| `actor_oid` | OID string | null | Exact actor worker OID filter |
| `created_at_from` | ISO8601 datetime | null | Created-at lower bound (inclusive) |
| `created_at_to` | ISO8601 datetime | null | Created-at upper bound (inclusive) |
| `updated_at_from` | ISO8601 datetime | null | Updated-at lower bound (inclusive) |
| `updated_at_to` | ISO8601 datetime | null | Updated-at upper bound (inclusive) |
| `effective_at_from` | ISO8601 datetime | null | Effective-at lower bound (inclusive) |
| `effective_at_to` | ISO8601 datetime | null | Effective-at upper bound (inclusive) |
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |

Use `GET /objects/activities/inquiries/{oid}` for exact OID lookup.

### ABAC Filtering

Same as Incidents (Anchored on **Actor**).

---

## API 4: Interactions (`/objects/activities/interactions`)

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
    actor_stable_id: str  # resolved to actor_oid at ingest time via Worker.stable_id
    action_type: str  # preserve raw source action type
    content_text: Optional[str] = None
    content_raw: Optional[Dict[str, Any]] = None
    response_text: Optional[str] = None
    response_raw: Optional[Dict[str, Any]] = None
    helpful_score: Optional[int] = None  # SSC dashboard: -1/0/1 (clamped via ge=-1, le=1)
    created_at: datetime
    effective_at: Optional[datetime] = None  # defaults to created_at when omitted
    ingested_at: Optional[datetime] = None

class InteractionBatchAssignRequest(BaseModel):
    run_id: Optional[str] = None
    batch_id: Optional[str] = None
    assignments: List[InteractionAssignItem]  # 1..500, unique stable_id per request

class InteractionAssignItem(BaseModel):
    stable_id: str
    assignment_status: Optional[Literal["assigned"]] = None  # null allowed (clear assignment)
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
    action_type: str
    content_text: Optional[str]
    content_raw: Optional[Dict[str, Any]]
    response_text: Optional[str]
    response_raw: Optional[Dict[str, Any]]
    assignment_status: Optional[Literal["assigned"]]
    assigned_inquiry_oid: Optional[str]
    assignment_updated_at: Optional[datetime]
    assignment_log: Optional[Dict[str, Any]]

    # SSC dashboard — AI-derived (populated by digest_interactions DAG)
    ai_ci: Optional[str] = None  # free-text concern indicator
    ai_code: Optional[ReviewCode] = None  # ACCT/IMP/ERR/NEW/QNC/CUST/OOS
    helpful_score: Optional[int] = None  # -1/0/1, sourced from chatbot is_helpful

    # SSC dashboard — human review overrides
    review_ci: Optional[str] = None
    review_code: Optional[ReviewCode] = None
    review_needs_optimization: Optional[bool] = None
    review_optimization_notes: Optional[str] = None
    review_completed_at: Optional[datetime] = None
    review_completed_by_oid: Optional[str] = None  # raw OID; resolve display name via workerMap

    created_at: datetime
    effective_at: datetime
    ingested_at: datetime
    updated_at: datetime

# Type alias used by ai_code / review_code / InteractionReviewUpdate.review_code:
ReviewCode = Literal["ACCT", "IMP", "ERR", "NEW", "QNC", "CUST", "OOS"]

class InteractionListResponse(BaseModel):
    items: List[InteractionResponse]
    total: int
    skip: int
    limit: int
    sort_by: Literal["created_at", "ingested_at", "updated_at"]
    order: Literal["asc", "desc"]

class InteractionUpdate(BaseModel):
    """General partial update for AI-derived interaction fields.

    Used by the `digest_interactions` Airflow DAG to PATCH `ai_ci` / `ai_code`,
    and by the sync pipeline for `helpful_score`. NOT for human review fields —
    those go through InteractionReviewUpdate which carries `mark_completed`.
    At least one field must be set, or the request returns 422.
    """

    ai_ci: Optional[str] = None
    ai_code: Optional[ReviewCode] = None
    helpful_score: Optional[int] = None  # ge=-1, le=1

class InteractionReviewUpdate(BaseModel):
    """Partial update for SSC dashboard human review fields."""

    review_ci: Optional[str] = None
    review_code: Optional[ReviewCode] = None
    review_needs_optimization: Optional[bool] = None
    review_optimization_notes: Optional[str] = None
    mark_completed: Optional[bool] = None
    # mark_completed semantics:
    #   true   → set review_completed_at = now(), review_completed_by_oid = current worker
    #   false  → clear both fields
    #   None   → leave both fields untouched
    # NOTE: mark_completed=true requires the caller to be a worker-linked account.
    # Service tokens are rejected with HTTP 400.
```

> **Timestamp behavior**: request datetimes are normalized to UTC. Naive timestamps are treated as UTC.
>
> **Batch decide behavior**:
> - This endpoint must call LLM for decision making (`attach/create/defer`), including `dry_run=true`.
> - `dry_run=true`: returns decision payload without DB write.
> - `dry_run=false`: applies decisions directly to DB (including inquiry creation for `create`).
> - Same `run_id + batch_id` replay is idempotent and returns `replayed_count`.
> - Invalid or missing LLM decision items downgrade to `defer` with `parser_status="fallback"`.
> - Prompt includes full button-key glossary reference from `data/chatbot/button_key_meanings.md`.
> - Interaction context uses text fields (`content_text`, `response_text`) without raw payload blobs.

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/activities/interactions/batch-upsert` | Batch idempotent upsert by `stable_id` | `objects:interactions:write` |
| POST | `/objects/activities/interactions/batch-assign` | Batch write assignment status/inquiry | `objects:interactions:write` |
| POST | `/objects/activities/interactions/batch-decide-assignment` | LLM batch decide + optional write-through assignment | `objects:interactions:write` |
| GET | `/objects/activities/interactions` | List interactions with filters | `objects:interactions:read` |
| GET | `/objects/activities/interactions/{interaction_oid}` | Get single interaction | `objects:interactions:read` |
| PATCH | `/objects/activities/interactions/{interaction_oid}` | General partial update for AI-derived fields (`ai_ci` / `ai_code` / `helpful_score`). Used by `digest_interactions` DAG and sync pipeline. | `objects:interactions:write` |
| PATCH | `/objects/activities/interactions/{interaction_oid}/review` | Update SSC dashboard human-review fields (incl. `mark_completed`) | `objects:interactions:write` |
| DELETE | `/objects/activities/interactions/{interaction_oid}` | Delete single interaction | `objects:interactions:write` |

> **`PATCH /{interaction_oid}` semantics** (general AI-derived update):
> - Body is `InteractionUpdate`. At least one field must be set or returns `422`.
> - Only fields present in the JSON body are written. Fields valid: `ai_ci`, `ai_code`, `helpful_score`.
> - `ai_code` must be one of: `ACCT`, `IMP`, `ERR`, `NEW`, `QNC`, `CUST`, `OOS`.
> - `helpful_score` is clamped to `-1`, `0`, or `1`.
> - ABAC: same WORKER_ORG anchor as the rest of the interaction surface.
> - Does NOT touch any `review_*` fields. For human review, use the `/review` endpoint below.
>
> **`PATCH /{interaction_oid}/review` semantics** (SSC dashboard):
> - Body is `InteractionReviewUpdate`. At least one field must be set.
> - Only fields present in the JSON body are written.
> - `review_code` is constrained to the same `ReviewCode` enum as `ai_code`.
> - `mark_completed=true` sets `review_completed_at = now()` and `review_completed_by_oid = current user's worker_oid`. Requires a worker-linked account; service tokens are rejected with `400`.
> - `mark_completed=false` clears both fields.
> - Omitting `mark_completed` (or sending `null`) leaves the completion state untouched.
> - Returns the full `InteractionResponse` after the update.
> - ABAC: same WORKER_ORG anchor. Returns `403` if the interaction exists but the requester lacks scope.

> **ABAC note**: Interaction list/get/delete APIs are ABAC-filtered via `actor_oid` → `Worker.org_oid` (WORKER_ORG anchor). The `actor_oid` column is resolved from `actor_stable_id` → `Worker.stable_id` at ingest time. Interactions with `actor_oid = NULL` are only visible to unconstrained users. Returns `403` if the interaction exists but the requester lacks scope access.

### Query Parameters (`GET /objects/activities/interactions`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `stable_id` | string | null | Exact stable id filter |
| `stable_id_prefix` | string | null | Prefix stable id filter |
| `actor_stable_id` | string | null | Actor filter |
| `source_system` | string | null | Source system filter |
| `assignment_status` | `assigned`/`null` | null | Assignment state filter |
| `assigned_inquiry_oid` | string | null | Assigned inquiry OID filter |
| `created_at_from` | ISO8601 datetime | null | Created-at lower bound |
| `created_at_to` | ISO8601 datetime | null | Created-at upper bound |
| `updated_at_from` | ISO8601 datetime | null | Updated-at lower bound |
| `updated_at_to` | ISO8601 datetime | null | Updated-at upper bound |
| `effective_at_from` | ISO8601 datetime | null | Effective-at lower bound |
| `effective_at_to` | ISO8601 datetime | null | Effective-at upper bound |
| `needs_optimization` | boolean | null | SSC dashboard: `true` → only interactions flagged `review_needs_optimization=true`; `false` → only interactions flagged `false`; `null` → no filter |
| `completed` | boolean | null | SSC dashboard: `true` → only reviews where `review_completed_at IS NOT NULL`; `false` → only `IS NULL` |
| `skip` | integer | 0 | Records to skip |
| `limit` | integer | 100 | Max records (1-1000) |
| `sort_by` | `created_at`/`ingested_at`/`updated_at` | `created_at` | Sort field |
| `order` | `asc`/`desc` | `desc` | Sort direction |

Interactions now store both `actor_stable_id` (text, from source system) and `actor_oid` (BYTEA(16), FK to `objects.workers.oid`, nullable). The `actor_oid` is resolved from `actor_stable_id` → `Worker.stable_id` during `batch-upsert`. ABAC filtering uses `actor_oid` to anchor to the actor's organization hierarchy.

List response now returns `InteractionListResponse` with:
- `items`: current page records
- `total`: total matched records for current filters
- `skip`, `limit`, `sort_by`, `order`: echo of applied pagination/sort options

Default order is `created_at DESC`, with secondary tie-breaker `oid DESC` for stable pagination.

### Error Responses (Common Interaction APIs)

| Status | Condition | Example |
|--------|-----------|---------|
| 403 | ABAC access denied (interaction exists but outside scope) | `{"detail": "Access denied to this interaction"}` |
| 404 | Interaction not found / missing stable ids | `{"detail":{"message":"Interactions not found","code":"not_found","missing_stable_ids":[...]}}` |
| 404 | Missing inquiry target/candidate | `{"detail":{"message":"Target inquiry not found","code":"not_found","missing_inquiry_oids":[...]}}` |
| 422 | Invalid OID format or payload validation | `{"detail":{"message":"Validation error","code":"validation_error","errors":[...]}}` |
| 502 | LLM upstream HTTP/API error | `{"detail":{"message":"LLM upstream API error: ...","code":"upstream_error"}}` |
| 503 | LLM timeout/config/service unavailable | `{"detail":{"message":"LLM request timed out","code":"service_unavailable"}}` |
| 500 | Unexpected internal failure | `{"detail":{"message":"batch-decide-assignment failed: ...","code":"internal_error"}}` |

### Constraints and Indexes

- Unique: `stable_id`
- `action_type` is raw source text (not enum-constrained)
- Check: only `assigned`/`null` are valid assignment states, and `assignment_status='assigned'` requires non-null `assigned_inquiry_oid`
- Check (SSC dashboard):
  - `ai_code IN ('ACCT', 'IMP', 'ERR', 'NEW', 'QNC', 'CUST', 'OOS')` (or NULL)
  - `review_code IN ('ACCT', 'IMP', 'ERR', 'NEW', 'QNC', 'CUST', 'OOS')` (or NULL)
  - `helpful_score BETWEEN -1 AND 1` (or NULL)
- Indexes:
  - `(actor_stable_id, created_at DESC)`
  - `(actor_oid)` — for ABAC joins
  - `(assignment_status, created_at DESC)`
  - `(assigned_inquiry_oid, created_at DESC)`
  - Partial: `(review_needs_optimization)` WHERE `review_needs_optimization IS TRUE` — speeds up SSC dashboard "needs optimization" filter

Incidents (SSC dashboard additions):
- Check: `csat_score BETWEEN 1 AND 5` (or NULL)
- Indexes:
  - GIN: `pre_ticket_interaction_oids` — for `@>` / `&&` array containment lookups
  - GIN: `related_kb_article_oids`
  - Partial: `(review_needs_optimization)` WHERE `review_needs_optimization IS TRUE`

## API 5: Activities Embed Search (`/objects/activities/embed_search`)

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
| POST | `/objects/activities/embed_search` | Search activity embeddings | `objects:incidents:read` or `objects:requests:read` or `objects:inquiries:read` |

**Notes**
- Search results are ordered by the embedding search ranking.
- Each result is filtered by ABAC rules for its object type (`incident` / `request` / `inquiry`).

---

## Appendix: SSC Dashboard fields cross-reference

The SSC dashboard added several columns and three PATCH endpoints across `incidents` and `interactions`. This appendix ties everything together so frontend integrators can find the surface in one place.

### Incident additions

| Column | Type | Populated by | Purpose |
|---|---|---|---|
| `bases.fact` (existing) | text | `digest_incidents` DAG | LLM-generated summary; AI summary lives here, **not** on a new column |
| `review_summary` | text | human via `PATCH /review` | Reviewer override of `bases.fact` |
| `review_needs_optimization` | boolean | human via `PATCH /review` | Triage flag for the dashboard |
| `review_optimization_notes` | text | human via `PATCH /review` | Free-text reviewer notes |
| `review_completed_at` | timestamptz | `mark_completed` flag | Set/cleared as a unit with `review_completed_by_oid` |
| `review_completed_by_oid` | bytea(16) FK workers | `mark_completed` flag | Worker who marked review complete; service tokens cannot set this |
| `pre_ticket_interaction_oids` | bytea(16)[] | `digest_incidents` DAG | Interactions in the 1h window before the ticket — `[]` if none, NULL if not yet computed |
| `related_kb_article_oids` | bytea(16)[] | `digest_incidents` DAG | Hyaide-embedding matches against active KB articles — `[]` if no matches above `RELATED_KB_MIN_CONFIDENCE` |
| `csat_score` | smallint (1..5) | external CSAT pipeline (not yet wired) | Currently always NULL — see catch-up plan |
| `csat_text` | text | external CSAT pipeline (not yet wired) | Currently always NULL |

### Interaction additions

| Column | Type | Populated by | Purpose |
|---|---|---|---|
| `ai_ci` | text | `digest_interactions` DAG | LLM-classified concern indicator (free text) |
| `ai_code` | text (enum) | `digest_interactions` DAG | LLM-classified category: `ACCT`/`IMP`/`ERR`/`NEW`/`QNC`/`CUST`/`OOS` |
| `helpful_score` | smallint (-1..1) | `sync_chatbot_interactions` DAG | Extracted from `content_raw.record.is_helpful` |
| `review_ci` | text | human via `PATCH /review` | Reviewer override of `ai_ci` |
| `review_code` | text (enum) | human via `PATCH /review` | Reviewer override of `ai_code` (same enum) |
| `review_needs_optimization` | boolean | human via `PATCH /review` | Triage flag for the dashboard |
| `review_optimization_notes` | text | human via `PATCH /review` | Free-text reviewer notes |
| `review_completed_at` | timestamptz | `mark_completed` flag | Set/cleared as a unit with `review_completed_by_oid` |
| `review_completed_by_oid` | bytea(16) FK workers | `mark_completed` flag | Same constraint as incidents |

### PATCH endpoint summary

| Endpoint | Body | Permission | Used by |
|---|---|---|---|
| `PATCH /objects/activities/incidents/{oid}/review` | `IncidentReviewUpdate` | `objects:incidents:write` | Frontend SSC dashboard |
| `PATCH /objects/activities/interactions/{interaction_oid}` | `InteractionUpdate` | `objects:interactions:write` | `digest_interactions` DAG (sets `ai_ci`/`ai_code`); sync pipeline (sets `helpful_score`) |
| `PATCH /objects/activities/interactions/{interaction_oid}/review` | `InteractionReviewUpdate` | `objects:interactions:write` | Frontend SSC dashboard |

### Frontend display notes

- `review_completed_by_oid` is returned as a raw OID string. Display names are resolved client-side via the `workerMap` pattern (B9), not by eager-loading on the backend.
- `pre_ticket_interaction_oids` and `related_kb_article_oids` carry three states the UI must distinguish: `null` (not yet computed by digest DAG), `[]` (computed, no matches), `[oid, ...]` (computed with results). Show "pending" for null, "none" for `[]`, the actual links for `[oid, ...]`.
- `csat_score` / `csat_text` will currently be NULL across the board. Display "CSAT data not yet available" until the OHLA email-survey ingestion pipeline is built.
- The `needs_optimization` and `completed` query filters on both list endpoints are tri-state: omit them entirely (no filter) vs `false` (only flagged/incomplete) vs `true` (only flagged/complete).
