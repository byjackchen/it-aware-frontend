# Auth Module API Specifications

## Overview

The Auth module provides authentication and authorization configuration. It consists of two main areas:

1. **Authentication APIs** - Session-based (cookie) and service-based (token) authentication
2. **Configuration APIs** - ABAC (Attribute-Based Access Control) model management

### Account vs Worker Model

The system separates identity concerns:

- **Account** (auth schema) - Authentication identity with username, password, and group assignments
- **Worker** (objects schema) - Organizational identity with employee info and hierarchy role assignments

System accounts (e.g., API services) have no linked Worker. Regular accounts are linked to exactly one Worker via `auth.account_worker` table.

---

## Security Model

### Authentication APIs

| Endpoint | Authentication |
|----------|----------------|
| `/auth/session/*` | Cookie-based (httpOnly) |
| `/auth/service/*` | Bearer token in header |
| `/auth/me` | Either cookie or bearer token |

### Configuration APIs

All configuration endpoints require authentication plus specific permissions:

| Resource | Read Permission | Edit Permission |
|----------|----------------|-----------------|
| Roles | `auth:roles:read` | `auth:roles:edit` |
| Permissions | `auth:permissions:read` | `auth:permissions:edit` |
| Groups | `auth:groups:read` | `auth:groups:edit` |
| Accounts | `auth:accounts:read` | `auth:accounts:edit` |
| Account Groups | `auth:account_groups:read` | `auth:account_groups:edit` |
| Account Workers | `auth:account_workers:read` | `auth:account_workers:edit` |
| Group Permissions | `auth:group_permissions:read` | `auth:group_permissions:edit` |
| Group Roles | `auth:group_roles:read` | `auth:group_roles:edit` |

**Note:** Worker and Worker-Hierarchy-Role management is under `/objects/*` with `objects:workers:*` and `objects:worker_hierarchy_roles:*` permissions. See `api_specs_objects.md`.

---

## Data Models

### ABAC Model Overview

```
┌──────────┐     ┌───────────┐     ┌────────────┐
│ Account  │────▶│   Group   │────▶│ Permission │
└──────────┘     └───────────┘     └────────────┘
     │                │
     │ (1:1 link)     │ (if role_based scope)
     ▼                ▼
┌──────────┐     ┌────────┐
│  Worker  │────▶│  Role  │◀──── WorkerHierarchyRole
└──────────┘     └────────┘              │
                                         ▼
                                   ┌───────────┐
                                   │ Hierarchy │
                                   └───────────┘
```

### Scope Types

| Scope Type | Description | Use Case |
|------------|-------------|----------|
| `unconstrained` | No row-level filtering | Super admin, system accounts |
| `self_scoped` | Worker can only access own records | Personal data management |
| `role_based` | Access filtered by hierarchy assignment | Department/team-based access |

**Note:** System accounts should only have `unconstrained` scope permissions.

### Core Models

```python
class Account(Base):
    __tablename__ = "accounts"
    __table_args__ = {"schema": "auth"}

    oid = Column(BYTEA(16), primary_key=True)
    username = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=True)  # Required for system accounts
    is_active = Column(Boolean, default=True)
    is_system = Column(Boolean, default=False)   # True for API/service accounts
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

class AccountWorker(Base):
    """1:1 link between Account and Worker (non-system accounts only)"""
    __tablename__ = "account_worker"
    __table_args__ = {"schema": "auth"}

    account_oid = Column(BYTEA(16), ForeignKey("auth.accounts.oid"), primary_key=True)
    worker_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), primary_key=True)
    linked_at = Column(DateTime(timezone=True), server_default=func.now())

class Role(Base):
    oid = Column(BYTEA(16), primary_key=True)
    name = Column(Text, unique=True, nullable=False)
    include_desc = Column(Boolean, default=True)  # Include descendants in hierarchy

class Permission(Base):
    oid = Column(BYTEA(16), primary_key=True)
    domain = Column(Text, nullable=False)    # e.g., 'auth', 'objects', '*'
    resource = Column(Text, nullable=False)  # e.g., 'accounts', 'tickets', '*'
    action = Column(Text, nullable=False)    # e.g., 'read', 'edit', '*'

class Group(Base):
    oid = Column(BYTEA(16), primary_key=True)
    name = Column(Text, unique=True, nullable=False)
    scope_type = Column(Text, nullable=False)  # 'unconstrained'|'self_scoped'|'role_based'

class WorkerHierarchyRole(Base):
    """Role assignment at hierarchy node - managed under /objects/worker-hierarchy-roles"""
    __tablename__ = "worker_hierarchy_role"
    __table_args__ = {"schema": "auth"}

    worker_oid = Column(BYTEA(16), ForeignKey("objects.workers.oid"), primary_key=True)
    role_oid = Column(BYTEA(16), ForeignKey("auth.roles.oid"), primary_key=True)
    hierarchy_oid = Column(BYTEA(16), ForeignKey("objects.hierarchies.oid"), primary_key=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
```

---

## API 1: Session Authentication (`/auth/session`)

Cookie-based authentication for web applications.

### Endpoints Summary

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/auth/session/token` | Login (SSO/Password) | No |
| POST | `/auth/session/refresh` | Refresh access token | Refresh cookie |
| POST | `/auth/session/logout` | Logout | No |

---

### 1.1 Login

**`POST /auth/session/token`**

Authenticates a regular account and sets httpOnly cookies. Supports both SSO and password authentication via the `grant_type` parameter.

**Request Body (form-urlencoded):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `grant_type` | string | Yes | Authentication method: `sso` or `password` |
| `username` | string | Yes | Account username |
| `password` | string | Conditional | Required when `grant_type=password` |

**Example Requests:**

```bash
# SSO login (no password)
curl -X POST /auth/session/token \
  -d "grant_type=sso" \
  -d "username=alice"

# Password login
curl -X POST /auth/session/token \
  -d "grant_type=password" \
  -d "username=alice" \
  -d "password=secret123"
```

**Response (200 OK):**

Sets cookies:
- `it_aware_access` - Access token (httpOnly)
- `it_aware_refresh` - Refresh token (httpOnly)

```json
{
  "message": "Login successful"
}
```

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid grant_type | `{"detail": "Invalid grant_type. Must be 'sso' or 'password'"}` |
| 400 | Invalid username | `{"detail": "Invalid username"}` |
| 400 | Missing password | `{"detail": "Password required for grant_type 'password'"}` |
| 400 | No password hash | `{"detail": "Account does not support password authentication"}` |
| 401 | Wrong password | `{"detail": "Invalid password"}` |
| 403 | Inactive account | `{"detail": "Inactive account"}` |

---

### 1.2 Refresh Token

**`POST /auth/session/refresh`**

Refreshes the access token using the refresh cookie.

**Response (200 OK):**

```json
{
  "message": "Token refreshed successfully"
}
```

---

### 1.3 Logout

**`POST /auth/session/logout`**

Clears authentication cookies.

**Response (200 OK):**

```json
{
  "message": "Logged out successfully"
}
```

---

## API 2: Service Authentication (`/auth/service`)

Token-based authentication for system/service accounts.

### Endpoints Summary

| Method | Path | Description | Auth Required |
|--------|------|-------------|---------------|
| POST | `/auth/service/token` | Get service token | No (API key) |
| POST | `/auth/service/refresh` | Refresh service token | Refresh token |

---

### 2.1 Service Login

**`POST /auth/service/token`**

Authenticates a system account and returns access/refresh tokens.

**Request Body (form-urlencoded):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `service_name` | string | Yes | System account username |
| `api_key` | string | Yes | System API key (password) |

**Response (200 OK):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 1800,
  "refresh_expires_in": 604800
}
```

---

### 2.2 Service Refresh Token

**`POST /auth/service/refresh`**

**Request Body (form-urlencoded):**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `refresh_token` | string | Yes | Refresh token from login |

**Response (200 OK):**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

---

## API 3: Current User (`/auth/me`)

### 3.1 Get Current User Info

**`GET /auth/me`**

Returns information about the authenticated account including linked worker, groups, and permissions.

**Authentication:** Cookie or Bearer token

**Response (200 OK) - Regular Account:**

```json
{
  "account": {
    "oid": "01JFXYZACC123456789AB",
    "username": "alice",
    "is_active": true,
    "is_system": false,
    "created_at": "2025-01-01T00:00:00Z"
  },
  "worker": {
    "oid": "01JFXYZWRK123456789AB",
    "worker_id": "EMP001",
    "full_name": "Alice Smith",
    "email": "alice@example.com",
    "org_oid": "01JFXYZORG123456789AB",
    "is_active": true
  },
  "groups": [
    {
      "oid": "01JFXYZGRP12345678ABCD",
      "name": "admin",
      "scope_type": "unconstrained"
    }
  ],
  "permissions": [
    "auth:accounts:read",
    "auth:accounts:edit",
    "objects:tickets:read",
    "objects:tickets:write"
  ]
}
```

**Response (200 OK) - System Account:**

```json
{
  "account": {
    "oid": "01JFXYZSYS123456789AB",
    "username": "api_service",
    "is_active": true,
    "is_system": true,
    "created_at": "2025-01-01T00:00:00Z"
  },
  "worker": null,
  "groups": [
    {
      "oid": "01JFXYZGRP12345678ABCD",
      "name": "super_admin",
      "scope_type": "unconstrained"
    }
  ],
  "permissions": [
    "*:*:*"
  ]
}
```

---

## API 4: Role Configuration (`/auth/config/roles`)

### Schemas

```python
class RoleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    include_desc: bool = True

class RoleUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    include_desc: Optional[bool] = None

class RoleResponse(BaseModel):
    oid: str
    name: str
    include_desc: bool
```

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/auth/config/roles` | Create role | `auth:roles:edit` |
| GET | `/auth/config/roles` | List roles | `auth:roles:read` |
| GET | `/auth/config/roles/{oid}` | Get role | `auth:roles:read` |
| PUT | `/auth/config/roles/{oid}` | Update role | `auth:roles:edit` |
| DELETE | `/auth/config/roles/{oid}` | Delete role | `auth:roles:edit` |

---

## API 5: Permission Configuration (`/auth/config/permissions`)

### Schemas

```python
class PermissionCreate(BaseModel):
    domain: str = Field(..., min_length=1, max_length=255)
    resource: str = Field(..., min_length=1, max_length=255)
    action: str = Field(..., min_length=1, max_length=255)

class PermissionResponse(BaseModel):
    oid: str
    domain: str
    resource: str
    action: str
    permission_code: str  # "{domain}:{resource}:{action}"
```

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/auth/config/permissions` | Create permission | `auth:permissions:edit` |
| GET | `/auth/config/permissions` | List permissions | `auth:permissions:read` |
| DELETE | `/auth/config/permissions/{oid}` | Delete permission | `auth:permissions:edit` |

---

## API 6: Group Configuration (`/auth/config/groups`)

### Schemas

```python
class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    scope_type: str = Field(..., pattern="^(unconstrained|self_scoped|role_based)$")

class GroupResponse(BaseModel):
    oid: str
    name: str
    scope_type: str
```

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/auth/config/groups` | Create group | `auth:groups:edit` |
| GET | `/auth/config/groups` | List groups | `auth:groups:read` |
| GET | `/auth/config/groups/{oid}` | Get group | `auth:groups:read` |
| PUT | `/auth/config/groups/{oid}` | Update group | `auth:groups:edit` |
| DELETE | `/auth/config/groups/{oid}` | Delete group | `auth:groups:edit` |

---

## API 7: Account Configuration (`/auth/config/accounts`)

### Schemas

```python
class AccountCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=255)
    is_active: bool = True
    is_system: bool = False
    password: Optional[str] = Field(None, min_length=8)  # Required for system accounts

class AccountUpdate(BaseModel):
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8)

class AccountResponse(BaseModel):
    oid: str
    username: str
    is_active: bool
    is_system: bool
    created_at: datetime
    updated_at: datetime
```

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/auth/config/accounts` | Create account | `auth:accounts:edit` |
| GET | `/auth/config/accounts` | List accounts | `auth:accounts:read` |
| GET | `/auth/config/accounts/{oid}` | Get account | `auth:accounts:read` |
| PUT | `/auth/config/accounts/{oid}` | Update account | `auth:accounts:edit` |
| DELETE | `/auth/config/accounts/{oid}` | Delete account | `auth:accounts:edit` |

---

## API 8: Account-Worker Link (`/auth/config/account_workers`)

Links accounts to workers (1:1 relationship, non-system accounts only).

### Schemas

```python
class AccountWorkerCreate(BaseModel):
    account_oid: str
    worker_oid: str

class AccountWorkerResponse(BaseModel):
    account_oid: str
    worker_oid: str
    linked_at: datetime
```

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/auth/config/account_workers` | Link account to worker | `auth:account_workers:edit` |
| GET | `/auth/config/account_workers` | List links | `auth:account_workers:read` |
| DELETE | `/auth/config/account_workers/{account_oid}` | Remove link | `auth:account_workers:edit` |

**Error Responses:**

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | System account | `{"detail": "Cannot link system account to worker"}` |
| 404 | Account not found | `{"detail": "Account not found"}` |
| 404 | Worker not found | `{"detail": "Worker not found"}` |
| 409 | Account already linked | `{"detail": "Account already linked to a worker"}` |
| 409 | Worker already linked | `{"detail": "Worker already linked to an account"}` |

---

## API 9: Account-Group Assignment (`/auth/config/account_groups`)

### Schemas

```python
class AccountGroupCreate(BaseModel):
    account_oid: str
    group_oid: str

class AccountGroupResponse(BaseModel):
    account_oid: str
    group_oid: str
    assigned_at: datetime
```

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/auth/config/account_groups` | Assign account to group | `auth:account_groups:edit` |
| GET | `/auth/config/account_groups` | List assignments | `auth:account_groups:read` |
| DELETE | `/auth/config/account_groups/{account_oid}/{group_oid}` | Remove assignment | `auth:account_groups:edit` |

---

## API 10: Group-Permission Assignment (`/auth/config/group_permissions`)

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/auth/config/group_permissions` | Assign permission to group | `auth:group_permissions:edit` |
| GET | `/auth/config/group_permissions` | List assignments | `auth:group_permissions:read` |
| DELETE | `/auth/config/group_permissions/{group_oid}/{permission_oid}` | Remove assignment | `auth:group_permissions:edit` |

---

## API 11: Group-Role Link (`/auth/config/group_roles`)

Links groups to roles for `role_based` scope resolution.

### Endpoints Summary

| Method | Path | Description | Permission |
|--------|------|-------------|------------|
| POST | `/auth/config/group_roles` | Link group to role | `auth:group_roles:edit` |
| GET | `/auth/config/group_roles` | List links | `auth:group_roles:read` |
| DELETE | `/auth/config/group_roles/{group_oid}/{role_oid}` | Remove link | `auth:group_roles:edit` |

---

## API Endpoint Summary

| # | Method | Path | Description | Permission |
|---|--------|------|-------------|------------|
| **Authentication** |||||
| 1 | POST | `/auth/session/token` | Login (SSO/Password) | - |
| 2 | POST | `/auth/session/refresh` | Refresh session token | Cookie |
| 3 | POST | `/auth/session/logout` | Logout | - |
| 4 | POST | `/auth/service/token` | Service login | API key |
| 5 | POST | `/auth/service/refresh` | Refresh service token | Token |
| 6 | GET | `/auth/me` | Get current account info | Auth |
| **Role Configuration** |||||
| 7 | POST | `/auth/config/roles` | Create role | `auth:roles:edit` |
| 8 | GET | `/auth/config/roles` | List roles | `auth:roles:read` |
| 9 | GET | `/auth/config/roles/{oid}` | Get role | `auth:roles:read` |
| 10 | PUT | `/auth/config/roles/{oid}` | Update role | `auth:roles:edit` |
| 11 | DELETE | `/auth/config/roles/{oid}` | Delete role | `auth:roles:edit` |
| **Permission Configuration** |||||
| 12 | POST | `/auth/config/permissions` | Create permission | `auth:permissions:edit` |
| 13 | GET | `/auth/config/permissions` | List permissions | `auth:permissions:read` |
| 14 | DELETE | `/auth/config/permissions/{oid}` | Delete permission | `auth:permissions:edit` |
| **Group Configuration** |||||
| 15 | POST | `/auth/config/groups` | Create group | `auth:groups:edit` |
| 16 | GET | `/auth/config/groups` | List groups | `auth:groups:read` |
| 17 | GET | `/auth/config/groups/{oid}` | Get group | `auth:groups:read` |
| 18 | PUT | `/auth/config/groups/{oid}` | Update group | `auth:groups:edit` |
| 19 | DELETE | `/auth/config/groups/{oid}` | Delete group | `auth:groups:edit` |
| **Account Configuration** |||||
| 20 | POST | `/auth/config/accounts` | Create account | `auth:accounts:edit` |
| 21 | GET | `/auth/config/accounts` | List accounts | `auth:accounts:read` |
| 22 | GET | `/auth/config/accounts/{oid}` | Get account | `auth:accounts:read` |
| 23 | PUT | `/auth/config/accounts/{oid}` | Update account | `auth:accounts:edit` |
| 24 | DELETE | `/auth/config/accounts/{oid}` | Delete account | `auth:accounts:edit` |
| **Account-Worker Link** |||||
| 25 | POST | `/auth/config/account_workers` | Link account to worker | `auth:account_workers:edit` |
| 26 | GET | `/auth/config/account_workers` | List account-worker links | `auth:account_workers:read` |
| 27 | DELETE | `/auth/config/account_workers/{account_oid}` | Remove account-worker link | `auth:account_workers:edit` |
| **Account-Group Assignment** |||||
| 28 | POST | `/auth/config/account_groups` | Assign account to group | `auth:account_groups:edit` |
| 29 | GET | `/auth/config/account_groups` | List account-group assignments | `auth:account_groups:read` |
| 30 | DELETE | `/auth/config/account_groups/{account_oid}/{group_oid}` | Remove account from group | `auth:account_groups:edit` |
| **Group-Permission Assignment** |||||
| 31 | POST | `/auth/config/group_permissions` | Assign permission to group | `auth:group_permissions:edit` |
| 32 | GET | `/auth/config/group_permissions` | List assignments | `auth:group_permissions:read` |
| 33 | DELETE | `/auth/config/group_permissions/{group_oid}/{permission_oid}` | Remove assignment | `auth:group_permissions:edit` |
| **Group-Role Link** |||||
| 34 | POST | `/auth/config/group_roles` | Link group to role | `auth:group_roles:edit` |
| 35 | GET | `/auth/config/group_roles` | List links | `auth:group_roles:read` |
| 36 | DELETE | `/auth/config/group_roles/{group_oid}/{role_oid}` | Remove link | `auth:group_roles:edit` |

**Note:** Worker-Hierarchy-Role management is under `/objects/worker-hierarchy-roles`. See `api_specs_objects.md`.

---

## Testing with cURL

### Complete ABAC Setup Example

```bash
#!/bin/bash
BASE_URL="http://localhost:8000"

# 1. Login as admin (system account)
echo "=== Login ==="
TOKEN=$(curl -s -X POST "$BASE_URL/auth/service/token" \
  -d "service_name=admin" \
  -d "api_key=admin_password" | jq -r '.access_token')

# 2. Create a worker first (via objects API)
echo -e "\n=== Create Worker ==="
WORKER=$(curl -s -X POST "$BASE_URL/objects/workers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"worker_id": "EMP001", "full_name": "Charlie Brown", "email": "charlie@example.com", "org_oid": "01JFXYZORG123456789"}')
WORKER_OID=$(echo $WORKER | jq -r '.oid')

# 3. Create a regular account
echo -e "\n=== Create Account ==="
ACCOUNT=$(curl -s -X POST "$BASE_URL/auth/config/accounts" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username": "charlie", "is_system": false}')
ACCOUNT_OID=$(echo $ACCOUNT | jq -r '.oid')

# 4. Link account to worker
echo -e "\n=== Link Account to Worker ==="
curl -s -X POST "$BASE_URL/auth/config/account_workers" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"account_oid\": \"$ACCOUNT_OID\", \"worker_oid\": \"$WORKER_OID\"}"

# 5. Create a role_based group
echo -e "\n=== Create Group ==="
GROUP=$(curl -s -X POST "$BASE_URL/auth/config/groups" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "ticket_managers", "scope_type": "role_based"}')
GROUP_OID=$(echo $GROUP | jq -r '.oid')

# 6. Assign account to group
echo -e "\n=== Assign Account to Group ==="
curl -s -X POST "$BASE_URL/auth/config/account_groups" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"account_oid\": \"$ACCOUNT_OID\", \"group_oid\": \"$GROUP_OID\"}"

# 7. Assign worker to role at hierarchy (via objects API)
echo -e "\n=== Assign Worker to Role at Hierarchy ==="
curl -s -X POST "$BASE_URL/objects/worker-hierarchy-roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"worker_oid\": \"$WORKER_OID\", \"role_oid\": \"01JFXYZROLE123456789\", \"hierarchy_oid\": \"01JFXYZORG123456789\"}"

# 8. Verify via /auth/me
echo -e "\n=== Login as charlie and check /auth/me ==="
curl -X POST "$BASE_URL/auth/session/token" -d "username=charlie" -c charlie.txt
curl -s -X GET "$BASE_URL/auth/me" -b charlie.txt | jq

rm -f charlie.txt
echo -e "\n=== Done ==="
```

---

## Notes

### OID Format

- All OIDs are 16-byte ULIDs encoded as 22-character base64url strings
- Example: `01JFXYZ123456789ABCDEF`

### Permission Code Format

Permissions follow the `{domain}:{resource}:{action}` format:
- `auth:accounts:read` - Read accounts in auth domain
- `objects:tickets:write` - Write tickets in objects domain
- `*:*:*` - Super permission (all access)

### Scope Types

| Type | ABAC Behavior |
|------|---------------|
| `unconstrained` | No row filtering, sees all records |
| `self_scoped` | Only sees records where `worker_oid = current_worker` |
| `role_based` | Sees records within hierarchy nodes assigned via `worker_hierarchy_role` |

### System vs Regular Accounts

| Aspect | System Account | Regular Account |
|--------|----------------|-----------------|
| `is_system` | `true` | `false` |
| Worker link | Not allowed | Required (via `account_worker`) |
| Auth method | API key (password) | SSO (no password) |
| Group scope | Only `unconstrained` | Any scope type |

### Cascade Behavior

- Deleting an account cascades to: `account_group`, `account_worker`
- Deleting a worker cascades to: `account_worker`, `worker_hierarchy_role`
- Deleting a group cascades to: `account_group`, `group_permission`, `group_role`
- Deleting a role cascades to: `worker_hierarchy_role`, `group_role`
