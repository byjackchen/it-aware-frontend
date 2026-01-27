# Activity Objects API Specifications

## Overview

Activity objects represents events or interactions in the system. All activities inherit from a base `Activities` table, providing a unified way to track actions, timestamps, and actors. All activities are also automatically synchronized to the **Global Registry** for searchability.

### Module Structure

```
/objects/
├── /activities
│   ├── /incident            - Incident management
│   └── /inquiry             - Inquiry management
```

## Security Model

All endpoints require authentication. Permissions follow the `{domain}:{resource}:{action}` pattern.

| Resource | Read Permission | Write Permission |
|----------|-----------------|------------------|
| Incidents | `objects:incidents:read` | `objects:incidents:write` |
| Inquiries | `objects:inquiries:read` | `objects:inquiries:write` |

**Note:** Activities primarily use ABAC (Attribute-Based Access Control) anchored on the **Actor** (the worker who performed/created the activity).

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
    actor_role = Column(Text, nullable=False) # e.g., "Caller", "User"
    
    # AI/Search context
    fact = Column(Text, nullable=True) # Text embedding source
    
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
    incident_id = Column(Text, unique=True, nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    state = Column(Text, nullable=False)
    priority = Column(Text, nullable=True)
    urgency = Column(Text, nullable=True)
    channel = Column(Text, nullable=True)
    
    assigned_to_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), nullable=True)
    service_catalog_oid = Column(BYTEA(16), ForeignKey("hierarchies.nodes.oid"), nullable=True)
    assigned_group = Column(Text, nullable=True)
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
    title: str
    description: Optional[str] = None
    priority: Optional[str] = None
    urgency: Optional[str] = None
    channel: Optional[str] = None
    assigned_to_oid: Optional[str] = None
    service_catalog_oid: Optional[str] = None
    assigned_group: Optional[str] = None
    fact: Optional[str] = None

class IncidentResponse(BaseModel):
    oid: str
    incident_id: str
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
    assigned_to_oid: Optional[str]
    service_catalog_oid: Optional[str]
    assigned_group: Optional[str]
    
    created_at: datetime
    updated_at: datetime
    effective_at: datetime
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/activities/incidents` | Create incident | `objects:incidents:write` |
| GET | `/objects/activities/incidents` | List incidents (ABAC) | `objects:incidents:read` |
| GET | `/objects/activities/incidents/{oid}` | Get incident (ABAC) | `objects:incidents:read` |
| PUT | `/objects/activities/incidents/{oid}` | Update incident (Explicit `fact` update) | `objects:incidents:write` |
| DELETE | `/objects/activities/incidents/{oid}` | Delete incident | `objects:incidents:write` |

> **Note on Registry Sync**: To update the global registry descriptor, you must explicitly provide the `fact` field in the `PUT` request body. It does not auto-sync from the `title`.

### ABAC Filtering

- **Unconstrained**: Sees all incidents.
- **Worker Organization**: See incidents where the **Actor** (Creator) belongs to an organization within the user's assigned hierarchy roles.

---

## API 2: Inquiries (`/objects/activities/inquiries`)

Inquiries represent questions or conversation threads (e.g., chat with AI or support).

### Schemas

```python
class InquiryCreate(BaseModel):
    topic: Optional[str] = None
    messages: Optional[List[Dict[str, Any]]] = None
    fact: Optional[str] = None

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
    
    created_at: datetime
    updated_at: datetime
    effective_at: datetime
```

### Endpoints

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/objects/activities/inquiries` | Create inquiry | `objects:inquiries:write` |
| GET | `/objects/activities/inquiries` | List inquiries (ABAC) | `objects:inquiries:read` |
| GET | `/objects/activities/inquiries/{oid}` | Get inquiry (ABAC) | `objects:inquiries:read` |
| PUT | `/objects/activities/inquiries/{oid}` | Update inquiry (Explicit `fact` update) | `objects:inquiries:write` |
| DELETE | `/objects/activities/inquiries/{oid}` | Delete inquiry | `objects:inquiries:write` |

> **Note on Registry Sync**: To update the global registry descriptor, you must explicitly provide the `fact` field in the `PUT` request body. It does not auto-sync from the `topic`.

### ABAC Filtering

Same as Incidents (Anchored on **Actor**).
