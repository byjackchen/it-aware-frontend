# Worker Hardwares Enhancement - Frontend Integration Guide

## Overview

This document provides technical guidance for integrating the new **Worker Hardwares** API into the frontend. Hardware records track assets (laptops, monitors, peripherals) assigned to workers, sourced from ServiceNow.

---

## API Endpoints

Base URL: `/objects/workers/{worker_oid}/hardwares`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/{worker_oid}/hardwares` | Create hardware record |
| `GET` | `/{worker_oid}/hardwares` | List all hardware for worker |
| `GET` | `/{worker_oid}/hardwares/{oid}` | Get specific hardware |
| `PUT` | `/{worker_oid}/hardwares/{oid}` | Update hardware |
| `DELETE` | `/{worker_oid}/hardwares/{oid}` | Delete hardware |

### Query Parameters (GET List)

| Parameter | Type | Description |
|-----------|------|-------------|
| `is_active` | boolean | Filter by active status |

---

## Data Model

### WorkerHardwareResponse

```typescript
interface WorkerHardware {
  oid: string;                      // Unique hardware ID
  worker_oid: string;               // Parent worker ID
  hardware_type: string;            // e.g., "Laptop", "Monitor", "Keyboard"
  tracking_id: string | null;       // ServiceNow display_name (unique)
  serial_number: string | null;     // Device serial number (unique)
  model: string | null;             // e.g., "MacBook Pro 16"
  assignment_date: string;          // ISO 8601 datetime
  renew_eligible_date: string | null; // When hardware can be renewed
  notes: string | null;             // Additional notes
  is_active: boolean;               // Soft deletion flag
  created_at: string;               // ISO 8601 datetime
  updated_at: string;               // ISO 8601 datetime
}
```

### WorkerHardwareCreate

```typescript
interface WorkerHardwareCreate {
  hardware_type: string;            // Required (1-100 chars)
  tracking_id?: string;             // Optional (max 255 chars)
  serial_number?: string;           // Optional (max 255 chars)
  model?: string;                   // Optional (max 255 chars)
  assignment_date: string;          // Required, ISO 8601
  renew_eligible_date?: string;     // Optional, ISO 8601
  notes?: string;                   // Optional
  is_active?: boolean;              // Default: true
}
```

### WorkerHardwareUpdate

```typescript
interface WorkerHardwareUpdate {
  hardware_type?: string;
  tracking_id?: string;
  serial_number?: string;
  model?: string;
  assignment_date?: string;
  renew_eligible_date?: string;
  notes?: string;
  is_active?: boolean;
}
```

---

## Example API Calls

### Fetch Hardware for a Worker

```typescript
// GET /objects/workers/{worker_oid}/hardwares
const response = await fetch(`/api/objects/workers/${workerOid}/hardwares`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
const hardwares: WorkerHardware[] = await response.json();
```

### Create Hardware

```typescript
// POST /objects/workers/{worker_oid}/hardwares
const newHardware: WorkerHardwareCreate = {
  hardware_type: "Laptop",
  tracking_id: "MacBook-001",
  serial_number: "C02XYZ123ABC",
  model: "MacBook Pro 16",
  assignment_date: "2024-01-15T00:00:00Z"
};

const response = await fetch(`/api/objects/workers/${workerOid}/hardwares`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(newHardware)
});
```

---

## Error Handling

| Status | Condition | Response |
|--------|-----------|----------|
| 404 | Worker not found | `{"detail": "Worker not found"}` |
| 404 | Hardware not found | `{"detail": "Hardware not found"}` |
| 409 | Duplicate tracking_id | `{"detail": "Tracking ID already exists"}` |
| 409 | Duplicate serial_number | `{"detail": "Serial number already exists"}` |

---

## UI Integration Suggestions

### Worker Detail Page

Add a "Hardware" tab or section to display assigned hardware:

```
┌─────────────────────────────────────────────────────────────┐
│ Worker: Alice Smith (asmith)                                │
├─────────────────────────────────────────────────────────────┤
│ [Profile] [Hardware] [Tickets]                              │
├─────────────────────────────────────────────────────────────┤
│ Hardware Assets (2)                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 💻 Laptop - MacBook Pro 16                              │ │
│ │    Serial: C02XYZ123ABC                                 │ │
│ │    Assigned: 2024-01-15  Renew: 2027-01-15             │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 🖥️ Monitor - Dell UltraSharp 27                         │ │
│ │    Serial: DELL12345                                    │ │
│ │    Assigned: 2024-06-01                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Hardware Type Icons

Map `hardware_type` to icons for visual distinction:

| hardware_type | Icon |
|---------------|------|
| Laptop | 💻 |
| Monitor | 🖥️ |
| Keyboard | ⌨️ |
| Mouse | 🖱️ |
| Headset | 🎧 |
| Phone | 📱 |
| Other/Unknown | 📦 |

### Renewal Status

Highlight hardware eligible for renewal:

```typescript
const isRenewable = (hardware: WorkerHardware): boolean => {
  if (!hardware.renew_eligible_date) return false;
  return new Date(hardware.renew_eligible_date) <= new Date();
};
```

---

## Data Source

Hardware data is synced from **ServiceNow** using:
- `scripts/load_worker_hardwares.py`

Field mappings from ServiceNow:

| ServiceNow Field | Our Field |
|------------------|-----------|
| `display_name` | `tracking_id` |
| `serial_number` | `serial_number` |
| `model_category.name` | `hardware_type` |
| `model` | `model` |
| `u_first_assigned_date` | `assignment_date` |

---

## Permissions

Hardware endpoints use the same permissions as Workers:

| Action | Permission |
|--------|------------|
| Read | `objects:workers:read` |
| Create/Update/Delete | `objects:workers:edit` |
