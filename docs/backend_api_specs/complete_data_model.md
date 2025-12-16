# Overall Data Structure

## 1. Overview

The IT-Aware Backend uses a PostgreSQL database organized into **four schemas**:

| Schema | Purpose | Key Tables |
|--------|---------|------------|
| `auth` | Authentication & Authorization | accounts, roles, permissions, groups |
| `objects` | Business Entities | hierarchies, organizations, locations, workers, tickets |
| `registry` | Global Object Registry | global_registry |
| `edges` | Object Relationships | global_edges |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              IT-AWARE DATA ARCHITECTURE                             │
└─────────────────────────────────────────────────────────────────────────────────────┘

                    ┌────────────────────────────────────────────┐
                    │           registry.global_registry         │
                    │  (Universal lookup for all business objects)│
                    └────────────────────┬───────────────────────┘
                                         │
                         ┌───────────────┼───────────────┐
                         │               │               │
                         ▼               ▼               ▼
                    ┌─────────┐    ┌─────────┐    ┌─────────────┐
                    │ Worker  │    │ Ticket  │    │ Organization │
                    │         │    │         │    │  / Location  │
                    └────┬────┘    └────┬────┘    └──────┬───────┘
                         │               │                │
                         │               │                │
                         ▼               ▼                ▼
                    ┌─────────────────────────────────────────────┐
                    │             edges.global_edges              │
                    │   (Edge Relationships between any objects) │
                    └─────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────┐
                    │                 auth.*                       │
                    │ (Accounts, Groups, Roles, Permissions, ABAC) │
                    └─────────────────────────────────────────────┘
```

---

## 3. Schema: `auth`

Authentication and authorization tables implementing ABAC (Attribute-Based Access Control).

### 3.1 Entity Relationship Diagram

```
┌─────────────────────┐
│   auth.accounts     │
├─────────────────────┤          ┌─────────────────────┐
│ oid (PK)            │──1:1────▶│  auth.account_worker │
│ username (UNIQUE)   │          ├─────────────────────┤
│ password_hash       │          │ account_oid (PK,FK) │
│ is_active           │          │ worker_oid (PK,FK)  │──────────┐
│ is_system           │          │ linked_at           │          │
│ created_at          │          └─────────────────────┘          │
│ updated_at          │                                           │
└─────────┬───────────┘                                           │
          │                                                       │
          │ M:N                                                   │
          ▼                                                       │
┌─────────────────────┐         ┌─────────────────────┐          │
│  auth.account_group │         │     auth.groups     │          │
├─────────────────────┤         ├─────────────────────┤          │
│ account_oid (PK,FK) │◀───────▶│ oid (PK)            │          │
│ group_oid (PK,FK)   │         │ name (UNIQUE)       │          │
│ assigned_at         │         │ scope_type          │          │
└─────────────────────┘         │  - unconstrained    │          │
                                │  - self_scoped      │          │
                                │  - role_based       │          │
                                └─────────┬───────────┘          │
                                          │                      │
                    ┌─────────────────────┼─────────────────────┐│
                    │                     │                     ││
                    ▼                     ▼                     ││
     ┌─────────────────────┐  ┌─────────────────────┐          ││
     │ auth.group_permission│  │  auth.group_role   │          ││
     ├─────────────────────┤  ├─────────────────────┤          ││
     │ group_oid (PK,FK)   │  │ group_oid (PK,FK)   │          ││
     │ permission_oid(PK,FK│  │ role_oid (PK,FK)    │────┐     ││
     └─────────┬───────────┘  └─────────────────────┘    │     ││
               │                                          │     ││
               ▼                                          ▼     ▼│
     ┌─────────────────────┐              ┌─────────────────────┐│
     │  auth.permissions   │              │     auth.roles      ││
     ├─────────────────────┤              ├─────────────────────┤│
     │ oid (PK)            │              │ oid (PK)            ││
     │ domain              │              │ name (UNIQUE)       ││
     │ resource            │              │ include_desc        ││
     │ action              │              └─────────┬───────────┘│
     └─────────────────────┘                        │            │
                                                    │            │
                                                    ▼            │
                                    ┌───────────────────────────┐│
                                    │ auth.worker_hierarchy_role ││
                                    ├───────────────────────────┤│
                                    │ worker_oid (PK,FK)        │◀┘
                                    │ role_oid (PK,FK)          │
                                    │ hierarchy_oid (PK,FK)     │──▶ objects.hierarchies
                                    │ assigned_at               │
                                    └───────────────────────────┘
```

### 3.2 Table Definitions

#### `auth.accounts`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `oid` | BYTEA(16) | PK | ULID identifier |
| `username` | TEXT | UNIQUE, NOT NULL | Login username |
| `password_hash` | TEXT | NULL | Bcrypt hash (NULL for SSO-only) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Account status |
| `is_system` | BOOLEAN | NOT NULL, DEFAULT FALSE | System/service account flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

#### `auth.account_worker`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `account_oid` | BYTEA(16) | PK, FK → accounts | Account reference |
| `worker_oid` | BYTEA(16) | PK, FK → workers, UNIQUE | Worker reference (one-to-one) |
| `linked_at` | TIMESTAMPTZ | NOT NULL | Link timestamp |

#### `auth.roles`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `oid` | BYTEA(16) | PK | ULID identifier |
| `name` | TEXT | UNIQUE, NOT NULL | Role name |
| `include_desc` | BOOLEAN | NOT NULL, DEFAULT TRUE | Include hierarchy descendants |

#### `auth.permissions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `oid` | BYTEA(16) | PK | ULID identifier |
| `domain` | TEXT | NOT NULL | Permission domain (e.g., "objects") |
| `resource` | TEXT | NOT NULL | Resource type (e.g., "ticket") |
| `action` | TEXT | NOT NULL | Action (e.g., "read", "*") |

**Unique Index:** `(domain, resource, action)`

#### `auth.groups`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `oid` | BYTEA(16) | PK | ULID identifier |
| `name` | TEXT | UNIQUE, NOT NULL | Group name |
| `scope_type` | TEXT | CHECK constraint | One of: `unconstrained`, `self_scoped`, `role_based` |

#### `auth.worker_hierarchy_role`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `worker_oid` | BYTEA(16) | PK, FK → workers | Worker reference |
| `role_oid` | BYTEA(16) | PK, FK → roles | Role reference |
| `hierarchy_oid` | BYTEA(16) | PK, FK → hierarchies | Hierarchy node reference |
| `assigned_at` | TIMESTAMPTZ | NOT NULL | Assignment timestamp |

#### Junction Tables

| Table | Columns | Purpose |
|-------|---------|---------|
| `auth.account_group` | account_oid, group_oid, assigned_at | Account ↔ Group |
| `auth.group_permission` | group_oid, permission_oid | Group ↔ Permission |
| `auth.group_role` | group_oid, role_oid | Group ↔ Role (for role_based scope) |

---

## 4. Schema: `objects`

Business entity tables representing the core domain objects.

### 4.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              HIERARCHICAL ENTITIES                               │
└─────────────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────────┐
                         │   objects.hierarchies   │
                         ├─────────────────────────┤
                         │ oid (PK)                │◀─────────────────────────┐
                         │ object_type             │                          │
                         │  - 'organization'       │                          │
                         │  - 'location'           │                          │
                         │ parent_oid (FK, self)   │──────────────────────────┤
                         │ path (BYTEA[])          │                          │
                         │ created_at              │                          │
                         │ updated_at              │                          │
                         └───────────┬─────────────┘                          │
                                     │                                        │
              ┌──────────────────────┼──────────────────────┐                 │
              │                      │                      │                 │
              ▼                      ▼                      │                 │
┌─────────────────────┐  ┌─────────────────────┐           │                 │
│objects.organizations│  │  objects.locations  │           │                 │
├─────────────────────┤  ├─────────────────────┤           │                 │
│ oid (PK,FK→hier.)  │  │ oid (PK,FK→hier.)   │           │                 │
│ name               │  │ name                │           │                 │
└─────────────────────┘  └─────────────────────┘           │                 │
                                                           │                 │
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              WORKER & TICKET ENTITIES                            │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│        objects.workers          │       │        objects.tickets          │
├─────────────────────────────────┤       ├─────────────────────────────────┤
│ oid (PK)                        │◀──────│ worker_oid (FK)                 │
│ worker_id (UNIQUE)              │       │ oid (PK)                        │
│ full_name                       │       │ org_oid (FK → organizations)    │
│ email (UNIQUE)                  │       │ status                          │
│ org_oid (FK → hierarchies)      │───────│ title                           │
│ manager_oid (FK → workers, self)│       │ created_at                      │
│ is_active                       │       └─────────────────────────────────┘
│ created_at                      │
│ updated_at                      │
└─────────────────────────────────┘
              │
              │ self-reference
              ▼
         (manager → reports)
```

### 4.2 Table Definitions

#### `objects.hierarchies`

Central table for hierarchical entities (organizations, locations).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `oid` | BYTEA(16) | PK | ULID identifier |
| `object_type` | TEXT | CHECK, NOT NULL | 'organization' or 'location' |
| `parent_oid` | BYTEA(16) | FK → self | Parent hierarchy node |
| `path` | BYTEA(16)[] | NOT NULL | Materialized path from root to self |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Path Example:**
- Root org A: path = `[A]`
- Org B under A: path = `[A, B]`
- Org C under B: path = `[A, B, C]`

#### `objects.organizations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `oid` | BYTEA(16) | PK, FK → hierarchies (CASCADE) | Shared key with hierarchies |
| `name` | TEXT | NOT NULL | Organization name |

#### `objects.locations`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `oid` | BYTEA(16) | PK, FK → hierarchies (CASCADE) | Shared key with hierarchies |
| `name` | TEXT | NOT NULL | Location name |

#### `objects.workers`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `oid` | BYTEA(16) | PK | ULID identifier |
| `worker_id` | TEXT | UNIQUE, NULL | External HR system ID |
| `full_name` | TEXT | NOT NULL | Display name |
| `email` | TEXT | UNIQUE, NULL | Email address |
| `org_oid` | BYTEA(16) | FK → hierarchies, NOT NULL | Organization assignment |
| `manager_oid` | BYTEA(16) | FK → self, NULL | Manager (self-reference) |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Active status |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

#### `objects.tickets`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `oid` | BYTEA(16) | PK | ULID identifier |
| `org_oid` | BYTEA(16) | FK → organizations, NOT NULL | Organization (for ABAC) |
| `worker_oid` | BYTEA(16) | FK → workers, NOT NULL | Owner worker (for self_scoped) |
| `status` | TEXT | NOT NULL | Ticket status |
| `title` | TEXT | NULL | Ticket title |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |

---

## 5. Schema: `registry`

Global registry providing universal lookup for all business objects.

### 5.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              GLOBAL REGISTRY                                     │
└─────────────────────────────────────────────────────────────────────────────────┘

                        ┌─────────────────────────────┐
                        │   registry.global_registry  │
                        ├─────────────────────────────┤
                        │ oid (PK)                    │
                        │ object_type                 │
                        │  - 'worker'                 │
                        │  - 'organization'           │
                        │  - 'location'               │
                        │  - 'ticket'                 │
                        │ descriptor                  │
                        │ created_at                  │
                        │ updated_at                  │
                        └──────────────┬──────────────┘
                                       │
                                       │ Synchronized via
                                       │ DB Triggers
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │objects.workers  │    │objects.tickets  │    │objects.organiz- │
    │                 │    │                 │    │  ations/locations│
    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 5.2 Table Definition

#### `registry.global_registry`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `oid` | BYTEA(16) | PK | ULID (same as source entity) |
| `object_type` | TEXT | CHECK, NOT NULL | Entity type |
| `descriptor` | TEXT | NOT NULL | Human-readable representation |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

**Indexes:**
- `global_registry_type_idx` on `object_type`
- GIN trigram index on `descriptor` for fuzzy search

### 5.3 Trigger Synchronization

The registry is automatically kept in sync via database triggers:

```sql
-- On INSERT into objects.workers
CREATE OR REPLACE FUNCTION objects.sync_worker_to_registry()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO registry.global_registry (oid, object_type, descriptor, created_at, updated_at)
  VALUES (NEW.oid, 'worker', NEW.full_name, NEW.created_at, NEW.updated_at);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Similar triggers exist for:
-- - objects.organizations → descriptor = name
-- - objects.locations → descriptor = name  
-- - objects.tickets → descriptor = title
```

---

## 6. Schema: `edges`

Graph-based relationships between any registered objects.

### 6.1 Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              GLOBAL EDGES                                        │
└─────────────────────────────────────────────────────────────────────────────────┘

   ┌─────────────────────────────┐          ┌─────────────────────────────┐
   │   registry.global_registry  │          │   registry.global_registry  │
   │        (from_oid)           │          │         (to_oid)            │
   └──────────────┬──────────────┘          └──────────────┬──────────────┘
                  │                                        │
                  │ FK (CASCADE)                           │ FK (CASCADE)
                  │                                        │
                  ▼                                        ▼
   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                           edges.global_edges                                 │
   ├─────────────────────────────────────────────────────────────────────────────┤
   │  COMPOSITE PRIMARY KEY: (from_oid, to_oid, edge_type)                       │
   ├─────────────────────────────────────────────────────────────────────────────┤
   │  from_oid        BYTEA(16)    FK → registry.global_registry (CASCADE)       │
   │  to_oid          BYTEA(16)    FK → registry.global_registry (CASCADE)       │
   │  edge_type       TEXT         Relationship type                              │
   │  edge_fact       TEXT         Factual description of relationship            │
   │  edge_metadata   JSONB        Additional metadata                            │
   │  is_active       BOOLEAN      Active status (default: true)                  │
   │  created_at      TIMESTAMPTZ  Creation timestamp                             │
   │  created_by      BYTEA(16)    Creator (nullable)                             │
   └─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Table Definition

#### `edges.global_edges`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `from_oid` | BYTEA(16) | PK, FK → global_registry (CASCADE) | Source object |
| `to_oid` | BYTEA(16) | PK, FK → global_registry (CASCADE) | Target object |
| `edge_type` | TEXT | PK | Relationship type |
| `edge_fact` | TEXT | NULL | Factual description |
| `edge_metadata` | JSONB | NULL | Additional JSON metadata |
| `is_active` | BOOLEAN | NOT NULL, DEFAULT TRUE | Active status |
| `created_at` | TIMESTAMPTZ | NOT NULL | Creation timestamp |
| `created_by` | BYTEA(16) | NULL | Creator OID |

**Indexes:**
- `global_edges_from_idx` on `from_oid`
- `global_edges_to_idx` on `to_oid`
- `global_edges_type_idx` on `edge_type`

### 6.3 Predefined Edge Types

| Edge Type | Description | Example |
|-----------|-------------|---------|
| `assigned_to` | Assignment | Ticket → Worker |
| `escalated_to` | Escalation | Ticket → Worker |
| `owned_by` | Ownership | Any → Worker |
| `created_by` | Creation | Any → Worker |
| `belongs_to` | Membership | Worker → Organization |
| `located_at` | Location | Worker → Location |
| `reports_to` | Reporting | Worker → Worker |
| `related_to` | Generic relation | Any → Any |
| `depends_on` | Dependency | Any → Any |
| `blocked_by` | Blocker | Ticket → Ticket |
| `duplicates` | Duplicate | Ticket → Ticket |

---

## 7. Complete ERD

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    COMPLETE DATA MODEL                                               │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

AUTH SCHEMA                              OBJECTS SCHEMA                         REGISTRY/EDGES SCHEMA
═══════════════                          ══════════════════                     ════════════════════════

┌─────────────┐                          ┌─────────────────┐                   ┌─────────────────────┐
│  accounts   │───────────────────┬─────▶│    workers      │──────────────────▶│  global_registry    │
└─────────────┘                   │      └────────┬────────┘                   └──────────┬──────────┘
      │                           │               │                                       │
      ▼                           │               ▼                                       │
┌─────────────┐                   │      ┌─────────────────┐                             │
│account_group│                   │      │   hierarchies   │◀──────────────────┐         │
└──────┬──────┘                   │      └────────┬────────┘                   │         │
       │                          │               │                            │         │
       ▼                          │      ┌────────┴────────┐                   │         │
┌─────────────┐                   │      ▼                 ▼                   │         │
│   groups    │                   │ ┌───────────┐   ┌───────────┐             │         │
└──────┬──────┘                   │ │organizations│ │ locations │─────────────┤         │
       │                          │ └───────────┘   └───────────┘             │         │
       │                          │                                            │         │
┌──────┴──────┐                   │      ┌─────────────────┐                   │         │
▼             ▼                   │      │    tickets      │───────────────────┤         │
┌───────────────┐ ┌───────────┐   │      └─────────────────┘                   │         │
│group_permission│ │group_role │   │                                           │         │
└───────┬───────┘ └─────┬─────┘   │                                            │         ▼
        │               │         │                                            │   ┌───────────────┐
        ▼               ▼         │                                            │   │  global_edges │
┌─────────────┐   ┌───────────┐   │                                            │   └───────────────┘
│ permissions │   │   roles   │   │                                            │         ▲
└─────────────┘   └─────┬─────┘   │                                            │         │
                        │         │                                            │         │
                        ▼         │                                            │         │
              ┌─────────────────────────┐                                      │         │
              │  worker_hierarchy_role  │◀─────────────────────────────────────┘         │
              └─────────────────────────┘                                                 │
                        │                                                                 │
                        └─────────────────────────────────────────────────────────────────┘
                                            (edges reference global_registry)
```

---

## 8. Data Types & Conventions

### 8.1 OID (Object Identifier)

All primary keys use **ULID** (Universally Unique Lexicographically Sortable Identifier):

- **Storage:** `BYTEA(16)` (16 bytes binary)
- **API Format:** 22-character base64url string
- **Example:** `01JFXYZ123456789ABCDEF`

Benefits:
- Sortable by creation time
- No collision risk
- URL-safe string representation

### 8.2 Timestamps

All timestamps use `TIMESTAMPTZ` (timestamp with timezone):
- Stored in UTC
- Default: `server_default=func.now()`

### 8.3 Soft Delete Pattern

Tables use `is_active` boolean flag for soft delete where applicable:
- `auth.accounts.is_active`
- `objects.workers.is_active`
- `edges.global_edges.is_active`

---

## 9. Key Relationships Summary

| From | To | Relationship | Type |
|------|----|--------------|------|
| Account | Worker | One-to-one | via account_worker |
| Account | Group | Many-to-many | via account_group |
| Group | Permission | Many-to-many | via group_permission |
| Group | Role | Many-to-many | via group_role |
| Worker | Role @ Hierarchy | Many-to-many | via worker_hierarchy_role |
| Worker | Organization | Many-to-one | via org_oid → hierarchies |
| Worker | Manager | Many-to-one | self-reference |
| Organization | Hierarchy | One-to-one | shared PK |
| Location | Hierarchy | One-to-one | shared PK |
| Hierarchy | Parent | Many-to-one | self-reference |
| Ticket | Organization | Many-to-one | FK |
| Ticket | Worker | Many-to-one | FK |
| GlobalRegistry | Source Entity | One-to-one | via triggers |
| GlobalEdge | GlobalRegistry | Many-to-one | both from_oid and to_oid |

---

## 10. ABAC Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐
│   Account   │───▶│   Groups    │───▶│ Permissions │───▶│   Permission Check  │
│             │    │             │    │             │    │                     │
│ username    │    │ scope_type: │    │ domain:     │    │ Does account have   │
│             │    │ - unconstr- │    │ resource:   │    │ permission for      │
│             │    │   ained     │    │ action:     │    │ domain:resource:    │
│             │    │ - self_     │    │             │    │ action?             │
│             │    │   scoped    │    │             │    │                     │
│             │    │ - role_     │    │             │    │                     │
│             │    │   based     │    │             │    │                     │
└─────────────┘    └──────┬──────┘    └─────────────┘    └─────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │    Scope Resolution   │
              ├───────────────────────┤
              │ unconstrained:        │
              │   → No filtering      │
              │                       │
              │ self_scoped:          │
              │   → Filter by         │
              │     worker_oid        │
              │                       │
              │ role_based:           │
              │   → Filter by         │
              │     hierarchy via     │
              │     worker_hierarchy_ │
              │     role assignments  │
              └───────────────────────┘
```

---

## 11. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-16 | Initial comprehensive data structure documentation |
