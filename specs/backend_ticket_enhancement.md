# Backend Ticket Enhancement - Frontend Integration Guide

## Overview
The Ticket model and API have been refactored to simplify ownership and access control. The `org_oid` field has been removed, and `worker_oid` has been renamed to `requester_oid`. Access control is now derived dynamically from the requester's organization.

## Key Changes for Frontend

### 1. Field Renaming & Removal
*   **`org_oid`**: REMOVED. You no longer need to send this field when creating a ticket, nor will you receive it in responses.
*   **`worker_oid`** -> **`requester_oid`**: The field identifying the ticket owner has been renamed.

### 2. API Schema Updates

#### Create Ticket (`POST /objects/tickets`)
*   **Request Body**:
    *   Remove `org_oid`.
    *   Use `requester_oid` instead of `worker_oid`.
    *   `requester_oid` is **OPTIONAL**. If omitted, it defaults to the currently logged-in user's linked worker profile.

    ```json
    // Old Payload
    {
      "title": "Fix laptop",
      "status": "open",
      "org_oid": "...",      // REMOVED
      "worker_oid": "..."    // RENAMED
    }

    // New Payload
    {
      "title": "Fix laptop",
      "status": "open",
      "requester_oid": "..." // OPTIONAL (Use only if creating on behalf of someone else)
    }
    ```

#### Ticket Response (`GET /objects/tickets`, `GET /objects/tickets/{oid}`)
*   **Response Object**:
    *   `org_oid` is gone.
    *   `worker_oid` is now `requester_oid`.
    *   `is_active` field is available.

    ```json
    {
      "oid": "...",
      "requester_oid": "...", // Previously worker_oid
      "status": "open",
      "title": "Fix laptop",
      "is_active": true,
      "created_at": "..."
    }
    ```

### 3. Access Control (ABAC)
*   Access logic is now "Self-Scoped" or "Role-Based" relative to the **Requester's Organization**.
*   **Visibility**:
    *   Users see their own tickets (where `requester_oid` == their worker OID).
    *   Managers/Admins see tickets where the *requester* is within their managed hierarchy.

## Action Items
1.  **Search & Replace**: Replace all occurrences of `worker_oid` with `requester_oid` in ticket-related components.
2.  **Remove**: Remove any logic that fetches or handles `org_oid` for tickets.
3.  **Creation Flow**:
    *   Simplify the ticket creation form. You likely don't need to ask for "Organization" anymore.
    *   If the user is creating a ticket for themselves, you can omit `requester_oid` entirely.
