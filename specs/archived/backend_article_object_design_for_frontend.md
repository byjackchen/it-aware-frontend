# Articles API - Frontend Integration Guide

## Overview

Articles are version-controlled knowledge base entries linked to the **Service Catalog** hierarchy. Each article maintains a complete version history, allowing users to view historical content while always defaulting to the current effective version.

---

## Core Concepts

### Article Structure

An **Article** is a container that holds:
- **Metadata**: OID, stable_id, service catalog association, timestamps
- **Versions**: Ordered list of content snapshots (v1, v2, v3...)
- **Effective Version**: The currently active version number

Each **Version** contains:
- Title, summary, markdown content
- Optional source attribution (system, URL)
- Freeform metadata (JSON object for tags, flags, etc.)

### Versioning Behavior

- **Create**: Creates Article + Version 1
- **Update (PUT)**: Creates a **new version** (does NOT modify existing versions)
- **Delete**: Soft-delete (sets `is_active = false`)

---

## API Endpoints

Base URL: `/objects/articles`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create new article |
| GET | `/` | List articles (paginated) |
| GET | `/{oid}` | Get article by OID |
| PUT | `/{oid}` | Update article (creates new version) |
| DELETE | `/{oid}` | Soft delete article |
| GET | `/{oid}/versions` | List all versions |
| GET | `/{oid}/versions/{version_number}` | Get specific version |

### Search via Global Registry

Articles are searchable through the unified registry search:

```
GET /registry/search?q=<search_term>&object_type=article&limit=20
```

Returns matching articles by title (descriptor).

---

## Request Schemas

### Create Article

```http
POST /objects/articles
Content-Type: application/json
Authorization: Bearer <token>

{
  "service_catalog_id": "AZuk2IimUj19wR3dC1ZgXg",
  "stable_id": "KB-001",                     // Optional unique identifier
  "title": "How to Reset Your Password",
  "summary": "Step-by-step password reset guide",
  "markdown": "# Password Reset\n\n1. Go to...",
  "source_system": "Confluence",             // Optional
  "source_url": "https://wiki.example.com/...", // Optional
  "metadata": {"tags": ["security", "self-service"]}, // Optional JSON
  "is_active": true                          // Default: true
}
```

### Update Article (New Version)

```http
PUT /objects/articles/{oid}
Content-Type: application/json
Authorization: Bearer <token>

{
  "title": "How to Reset Your Password (Updated)",
  "summary": "Revised password reset guide",
  "markdown": "# Password Reset v2\n\n...",
  "source_system": "Confluence",
  "source_url": "https://wiki.example.com/...",
  "metadata": {"tags": ["security", "updated"]},
  "is_active": true
}
```

> **Note**: PUT always creates a new version. The `effective_version_number` increments automatically.

---

## Response Schemas

### Article Response

```json
{
  "oid": "AZuk2riU6wm3a1oQIZsaKw",
  "stable_id": "KB-001",
  "service_catalog_id": "AZuk2IimUj19wR3dC1ZgXg",
  "effective_version_number": 2,
  "is_active": true,
  "created_at": "2026-01-09T10:00:00Z",
  "updated_at": "2026-01-09T14:30:00Z",
  "latest_version": {
    "version_number": 2,
    "title": "How to Reset Your Password (Updated)",
    "summary": "Revised password reset guide",
    "markdown": "# Password Reset v2\n\n...",
    "source_system": "Confluence",
    "source_url": "https://wiki.example.com/...",
    "metadata": {"tags": ["security", "updated"]},
    "created_at": "2026-01-09T14:30:00Z"
  }
}
```

### Version Response

```json
{
  "version_number": 1,
  "title": "How to Reset Your Password",
  "summary": "Step-by-step password reset guide",
  "markdown": "# Password Reset\n\n1. Go to...",
  "source_system": "Confluence",
  "source_url": "https://wiki.example.com/...",
  "metadata": {"tags": ["security", "self-service"]},
  "created_at": "2026-01-09T10:00:00Z"
}
```

### Registry Search Response

```json
[
  {
    "oid": "AZuk2riU6wm3a1oQIZsaKw",
    "object_type": "article",
    "descriptor": "How to Reset Your Password (Updated)",
    "created_at": "2026-01-09T10:00:00Z",
    "updated_at": "2026-01-09T14:30:00Z"
  }
]
```

---

## Error Responses

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid request | `{"detail": "..."}` |
| 403 | Access denied | `{"detail": "Access denied to this article"}` |
| 404 | Article not found | `{"detail": "Article not found"}` |
| 404 | Version not found | `{"detail": "Version not found"}` |
| 404 | Service Catalog not found | `{"detail": "Service Catalog not found"}` |

---

## Query Parameters

### List Articles (`GET /objects/articles`)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `is_active` | boolean | - | Filter by active status |
| `service_catalog_id` | string | - | Filter by service catalog OID |
| `skip` | int | 0 | Pagination offset |
| `limit` | int | 100 | Max results (1-1000) |

---

## Frontend Usage Examples

### Display Article List

```typescript
const response = await fetch('/objects/articles?is_active=true&limit=50', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const articles = await response.json();

// Each article includes latest_version for display
articles.forEach(article => {
  console.log(article.latest_version.title);
});
```

### View Article with Version History

```typescript
// Get current article
const article = await fetch(`/objects/articles/${oid}`).then(r => r.json());

// Get version history
const versions = await fetch(`/objects/articles/${oid}/versions`).then(r => r.json());

// Display version dropdown
versions.forEach(v => {
  console.log(`v${v.version_number}: ${v.title} (${v.created_at})`);
});
```

### Search Articles

```typescript
const query = encodeURIComponent('password reset');
const results = await fetch(`/registry/search?q=${query}&object_type=article&limit=10`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// Navigate to article detail
if (results.length > 0) {
  const articleOid = results[0].oid;
  // Redirect to /articles/{articleOid}
}
```

---

## Access Control

Article visibility is determined by the user's access to the linked **Service Catalog**:

- **Unrestricted users**: See all articles
- **Role-based users**: See articles within their assigned service catalog hierarchy

No special permissions are needed beyond read/write access to articles.

---

## Field Reference

### Article Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `oid` | string | read-only | Unique identifier |
| `stable_id` | string | optional | External/human-readable ID |
| `service_catalog_id` | string | **required** | Service Catalog OID |
| `effective_version_number` | int | read-only | Current version number |
| `is_active` | boolean | optional | Active status (default: true) |
| `created_at` | datetime | read-only | Creation timestamp |
| `updated_at` | datetime | read-only | Last update timestamp |
| `latest_version` | object | read-only | Embedded current version |

### Version Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version_number` | int | read-only | Version sequence number |
| `title` | string | **required** | Article title |
| `summary` | string | optional | Short description |
| `markdown` | string | **required** | Full content in Markdown |
| `source_system` | string | optional | Origin system name |
| `source_url` | string | optional | Link to original source |
| `metadata` | object | optional | Freeform JSON (tags, flags, etc.) |
| `created_at` | datetime | read-only | Version creation timestamp |
