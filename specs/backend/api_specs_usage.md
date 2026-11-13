# Usage API Specifications (View Usages)

## Overview

IT-Aware records two things people do, and nothing else about them: **signing in** and **opening a task**. The Administration task **View Usages** (`usages` in the [task catalog](api_specs_tasks.md), views `overview`, `tasks` and `unused-access`) reads that record through the three endpoints below.

Code: `app/usage/` (the model, the service, the routes). Migration `0140`.

## The record

`systems.usage_events` (transactional, only added): one row per event.

| Column | Type | Meaning |
|---|---|---|
| `oid` | bytea(16) | The row's id (a ULID, as every IT-Aware record) |
| `account_oid` | bytea(16) | The account. No foreign key: the record outlives the account |
| `kind` | text | `sign_in` or `task_open` |
| `task` | text, null | The task's catalog code; set for `task_open`, null for `sign_in` (a check constraint) |
| `view` | text, null | The slug of the view opened, when the page sent one |
| `occurred_at` | timestamptz | When; the database's `now()` |

Indexes: `occurred_at`; `(task, occurred_at)`; `(account_oid, occurred_at)`; `(task, account_oid, occurred_at)`. No request body, address, IP, user agent or query string is stored.

**No retention is set**: rows are never deleted or summarised, so the table grows with use. A limit is a decision still to make.

What writes it:

- **`sign_in`**: a successful `POST /auth/session/token` (either grant), the one place a person's sign-in completes. A refused sign-in writes nothing. **A token refresh (`POST /auth/session/refresh`) writes no event**, so a person whose session is kept alive by refreshes shows one sign-in, not one a day; their activity shows through the tasks they open. The service routes (`/auth/service/*`) are not sign-ins of a person and write nothing. Nothing is written while `IT_AWARE_TASKS_ENABLED` is off.
- **`task_open`**: `POST /tasks/recent`, for a task the caller has; the same account, task and view within 60 seconds is written once. The rules are in [tasks](api_specs_tasks.md#post-tasksrecent).

Writing is **fail-soft**: an event that cannot be written (for instance before migration 0140 has run) is logged as `usage: a <kind> event was not written (<error type>)` and the sign-in or the page is not affected. The write runs in a savepoint of the request's session, so a failure undoes only itself. It never waits long: inside the savepoint it first sets, for that transaction only, `lock_timeout` to 250 ms and `statement_timeout` to 2 s, so a write that meets a lock (a migration holding the table, say) gives up and the sign-in or the page goes on.

The 60-second rule holds for two requests at once: a `task_open` write first takes a transaction-level advisory lock on its account, task and view (`pg_advisory_xact_lock`, bounded by the same lock timeout), then looks for an event of the last minute, then writes.

## Permission and switch

| Code | Allows |
|---|---|
| `systems:usage:read` | The three endpoints below, and with them the task View Usages |

Migration `0140` creates the permission and gives it to every group that holds `systems:jobs:read` (or `systems:jobs:*`) when it runs: the groups migration `0138` gave the job read permission to, as they stand now. A wider wildcard (`*:*:*`, `systems:*:*`) already matches the new code.

Every endpoint answers `404` while `IT_AWARE_TASKS_ENABLED` is `false`, as the task endpoints do; `401` without a sign-in; `403` without the permission.

## The window

Every endpoint takes `days`: `7`, `30` (the default) or `90`; any other value is `422`. The window is that many whole **UTC days ending today**, today included: `days=7` on 10 June covers 4 June 00:00 UTC to now. Every answer says the window it used:

| Field | Type | Meaning |
|---|---|---|
| `days` | int | The window asked for |
| `start` | date | Its first UTC day |
| `end` | date | Its last UTC day: today |

"People" are distinct accounts. With no events every count is `0`, every list is complete or empty, and nothing is an error.

## GET /usage/overview

`?days=30`

```json
{
  "days": 30,
  "start": "2026-10-14",
  "end": "2026-11-12",
  "tracking_since": "2026-11-12",
  "active_people": {"today": 4, "last_7_days": 9, "window": 12},
  "sign_ins": 31,
  "task_opens": 187,
  "daily": [
    {"date": "2026-10-14", "active_people": 0, "task_opens": 0, "sign_ins": 0},
    {"date": "2026-11-12", "active_people": 4, "task_opens": 23, "sign_ins": 5}
  ]
}
```

- `tracking_since`: the UTC day of the first event ever; `null` with no events. Days before it are zeros because nothing was recorded, not because nobody came.
- `active_people`: distinct accounts with any event `today`, in the `last_7_days` (today and the six days before) and in the `window`.
- `sign_ins`, `task_opens`: events of each kind in the window.
- `daily`: one entry for every day of the window, the oldest first, the last one today; a day with no events is zeros.

## GET /usage/tasks

`?days=30`

```json
{
  "days": 30,
  "start": "2026-10-14",
  "end": "2026-11-12",
  "tasks": [
    {
      "task": "it-incidents",
      "opens": 42,
      "people": 7,
      "last_opened_at": "2026-11-12T08:15:02.123456Z",
      "holders": 15
    }
  ]
}
```

One entry for **every** task of the catalog, in catalog order (names and groupings are in `GET /tasks/catalog`).

- `opens`: `task_open` events of the task in the window. `people`: distinct accounts among them. `people` counts whoever opened it then, including accounts that no longer hold the task, are inactive now, or are not user accounts; so `holders − people` is **not** the number of unused holders. That number is `total` of `GET /usage/unused-access`.
- `last_opened_at`: the last time anyone opened it, **ever** (it can be before the window); `null` when never.
- `holders`: how many accounts have the task **now**: the active accounts of type `user` for which "who has what tasks" (`GET /tasks/access`, `app/tasks/access.py`) lists the task. Inactive accounts and integration accounts cannot sign in to open a page and are not counted.

## GET /usage/unused-access

`?task=it-incidents&days=30&limit=50&offset=0`: `task` is required (`422` without it; `404` for a code that is no task of the catalog). `limit` 1 to 200 (default 50), `offset` from 0.

```json
{
  "days": 30,
  "start": "2026-10-14",
  "end": "2026-11-12",
  "task": "it-incidents",
  "holders": 15,
  "total": 8,
  "accounts": [
    {"oid": "QUFBQUFBQUFBQUFBQUFBQQ", "username": "alice", "last_opened_at": "2026-09-30T02:11:45.000000Z"},
    {"oid": "QkJCQkJCQkJCQkJCQkJCQg", "username": "bob", "last_opened_at": null}
  ]
}
```

- `holders`: as in `GET /usage/tasks`.
- `total`: how many of the holders have no `task_open` of this task in the window.
- `accounts`: one page of them, by `username`. `oid` and `username` are the account's, as `GET /tasks/access` gives them. `last_opened_at`: that account's last open of this task ever; `null` when never.

An account that opened the task without holding it (its access was taken away since) is not listed.
