# Usage API Specifications (View Usages)

## Overview

IT-Aware records two things people do, and nothing else about them: **signing in** and **opening a task**. The Administration task **View Usages** (`usages` in the [task catalog](api_specs_tasks.md), views `overview`, `tasks`, `people` and `unused-access`) reads that record through the six read endpoints below. A seventh, `POST /usage/purge`, is the daily job's: it deletes the events past their [retention](#retention-13-months). Three of them **name individuals**: who opened one task, everyone who was active, and one person's tasks (see [Who](#who-the-reads-that-name-people)).

Code: `app/usage/` (the model, the service, the routes). Migration `0140`.

## The record

`systems.usage_events` (transactional; rows are only added, and deleted when older than the retention): one row per event.

| Column | Type | Meaning |
|---|---|---|
| `oid` | bytea(16) | The row's id (a ULID, as every IT-Aware record) |
| `account_oid` | bytea(16) | The account. No foreign key: the record outlives the account |
| `kind` | text | `sign_in` or `task_open` |
| `task` | text, null | The task's catalog code; set for `task_open`, null for `sign_in` (a check constraint) |
| `view` | text, null | The slug of the view opened, when the page sent one |
| `occurred_at` | timestamptz | When; the database's `now()` |

Indexes: `occurred_at`; `(task, occurred_at)`; `(account_oid, occurred_at)`; `(task, account_oid, occurred_at)`. No request body, address, IP, user agent or query string is stored.

**Retention is 13 months** (maintainer, 2026-11-12): an event older than 13 calendar months is deleted by the daily purge, [below](#retention-13-months). Nothing is summarised before it goes, so no read reaches further back than that.

What writes it:

- **`sign_in`**: a successful `POST /auth/session/token` (either grant), the one place a person's sign-in completes. A refused sign-in writes nothing. **A token refresh (`POST /auth/session/refresh`) writes no event**, so a person whose session is kept alive by refreshes shows one sign-in, not one a day; their activity shows through the tasks they open. The service routes (`/auth/service/*`) are not sign-ins of a person and write nothing.
- **`task_open`**: `POST /tasks/recent`, for a task the caller has; the same account, task and view within 60 seconds is written once. The rules are in [tasks](api_specs_tasks.md#post-tasksrecent).

Writing is **fail-soft**: an event that cannot be written (for instance before migration 0140 has run) is logged as `usage: a <kind> event was not written (<error type>)` and the sign-in or the page is not affected. The write runs in a savepoint of the request's session, so a failure undoes only itself. It never waits long: inside the savepoint it first sets, for that transaction only, `lock_timeout` to 250 ms and `statement_timeout` to 2 s, so a write that meets a lock (a migration holding the table, say) gives up and the sign-in or the page goes on.

The 60-second rule holds for two requests at once: a `task_open` write first takes a transaction-level advisory lock on its account, task and view (`pg_advisory_xact_lock`, bounded by the same lock timeout), then looks for an event of the last minute, then writes.

## Permission and switch

| Code | Allows |
|---|---|
| `systems:usage:read` | The six read endpoints below, and with them the task View Usages |
| `systems:jobs:run` | `POST /usage/purge` (the job account holds it; the read permission is neither needed nor enough) |

Migration `0140` creates the permission and gives it to every group that holds `systems:jobs:read` (or `systems:jobs:*`) when it runs: the groups migration `0138` gave the job read permission to, as they stand now. A wider wildcard (`*:*:*`, `systems:*:*`) already matches the new code.

Every endpoint answers `401` without a sign-in and `403` without the permission.

There is one permission, not two: whoever may see the counts may also see who is behind them (the reads under [Who](#who-the-reads-that-name-people)). Give `systems:usage:read` with that in mind. Nobody reads their own usage without it.

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

- `tracking_since`: the UTC day of the oldest event kept; `null` with no events. After a purge it is never before the retention's cutoff. Days before it are zeros because nothing was recorded, not because nobody came.
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

- `opens`: `task_open` events of the task in the window. `people`: distinct accounts among them. `people` counts whoever opened it then, including accounts that no longer hold the task; so `holders − people` is **not** the number of unused holders. That number is `total` of `GET /usage/unused-access`.
- `last_opened_at`: the last time anyone opened it, **ever** (it can be before the window); `null` when never.
- `holders`: how many accounts have the task **now**: every account for which "who has what tasks" (`GET /tasks/access`, `app/tasks/access.py`) lists the task. Inactive accounts and integration accounts are counted too (maintainer, 2026-11-12: count every account); `GET /usage/unused-access` says which each one is.

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
    {"oid": "QUFBQUFBQUFBQUFBQUFBQQ", "username": "alice", "active": true, "account_type": "user", "last_opened_at": "2026-09-30T02:11:45.000000Z"},
    {"oid": "QkJCQkJCQkJCQkJCQkJCQg", "username": "sync-bot", "active": false, "account_type": "integration", "last_opened_at": null}
  ]
}
```

- `holders`: as in `GET /usage/tasks`.
- `total`: how many of the holders have no `task_open` of this task in the window.
- `accounts`: one page of them, by `username` in the database's order (the order `GET /tasks/access` lists accounts in). `oid` and `username` are the account's, as `GET /tasks/access` gives them. `active`: whether the account can sign in now. `account_type`: `user` or `integration`. An inactive account and an integration account are listed like any other holder, so the page can label them. `last_opened_at`: that account's last open of this task ever; `null` when never.

An account that opened the task without holding it (its access was taken away since) is not listed.

## Who: the reads that name people

Three reads say **who** used **which** task. They name individual accounts (`oid` and `username`, as `GET /tasks/access` gives them, the same as `accounts` of `GET /usage/unused-access`) with what each did, and are behind the same permission as the counts, `systems:usage:read`.

They read the events alone, so they name whoever did it then: an account that no longer holds the task, is inactive now or is not a user account is listed like any other. An account that was **deleted** since still has its events (the record keeps no foreign key): it is listed with its `oid` and `"username": null`, after the named accounts where the order is otherwise equal.

Where a list is ordered by `username`, it is the database's order of usernames, as in `GET /tasks/access`. The two lists are paged as `GET /usage/unused-access` is: `limit` 1 to 200 (default 50), `offset` from 0, other values `422`; `total` counts the whole list, and an `offset` past the end is an empty page.

Each read finds its window through an index of migration `0140`: the people of a task and everyone through `(occurred_at)` or `(task, occurred_at)`, one person through `(account_oid, occurred_at)`. No index was added. (`tests/db/test_usage_db.py` checks the plans over a year of synthetic events.)

### GET /usage/tasks/{task}/people

`?days=30&limit=50&offset=0`: the people who opened one task in the window. `404` for a code that is no task of the catalog.

```json
{
  "days": 30,
  "start": "2026-10-14",
  "end": "2026-11-12",
  "task": "it-incidents",
  "total": 7,
  "people": [
    {
      "oid": "QUFBQUFBQUFBQUFBQUFBQQ",
      "username": "alice",
      "opens": 12,
      "views": ["detail", "list"],
      "last_opened_at": "2026-11-12T08:15:02.123456Z"
    }
  ]
}
```

- `total`: distinct accounts that opened the task in the window; the same number as `people` of that task in `GET /usage/tasks`.
- `people`: one page of them, by `opens` descending, then by `username`.
- `opens`: that account's `task_open` events of the task in the window. `last_opened_at`: the newest of them.
- `views`: the distinct view slugs those events carry, alphabetical. An open that named no view adds none, so the list can be empty.

### GET /usage/people

`?days=30&limit=50&offset=0`: every account with any event in the window.

```json
{
  "days": 30,
  "start": "2026-10-14",
  "end": "2026-11-12",
  "total": 12,
  "people": [
    {
      "oid": "QUFBQUFBQUFBQUFBQUFBQQ",
      "username": "alice",
      "sign_ins": 5,
      "task_opens": 40,
      "tasks": 6,
      "last_active_at": "2026-11-12T08:15:02.123456Z"
    }
  ]
}
```

- `total`: distinct accounts with any event in the window; the same number as `active_people.window` of `GET /usage/overview`.
- `people`: one page of them, by `task_opens` descending, then by `username`.
- `sign_ins`, `task_opens`: that account's events of each kind in the window. `tasks`: the distinct tasks among its opens.
- `last_active_at`: its newest event of either kind in the window.

### GET /usage/people/{oid}

`?days=30`: one account. `oid` is the account's, as the lists above give it.

```json
{
  "days": 30,
  "start": "2026-10-14",
  "end": "2026-11-12",
  "oid": "QUFBQUFBQUFBQUFBQUFBQQ",
  "username": "alice",
  "sign_ins": 5,
  "tasks": [
    {
      "task": "it-incidents",
      "opens": 12,
      "views": ["list"],
      "last_opened_at": "2026-11-12T08:15:02.123456Z"
    }
  ]
}
```

- `tasks`: every task the account opened in the window, by `opens` descending, then by task code, each as in the people of a task. A task code that is no longer in the catalog is still listed, as it was recorded. Not paged: there are at most as many entries as task codes.
- An account with no event in the window: `200`, `"sign_ins": 0`, `"tasks": []`, with its `username`.
- A deleted account whose events remain: `200`, `"username": null`.
- `404` for an `oid` that is no account's and has no event, and for a value that is no oid at all.

## Retention: 13 months

Usage events are kept for **13 calendar months** (`RETENTION_MONTHS` in `app/usage/service.py`, the one place the period is written), so a month can always be compared with the same month a year before. Older events are deleted once a day.

### POST /usage/purge

No body. Needs `systems:jobs:run` (`401` without a sign-in, `403` without it).

```json
{"deleted": 1840, "before": "2025-10-12T02:00:07.512345Z"}
```

- `before`: the cutoff, 13 calendar months before the call's time in UTC: the same day of the month and time of day (12 November 02:00 gives 12 October of the year before, 02:00), or the last day of that month when it has no such day (31 March gives 28 or 29 February).
- `deleted`: how many events with `occurred_at` before the cutoff this call deleted; `0` when there were none. An event exactly at the cutoff is kept.
- The rows go in batches of 5,000 (`PURGE_BATCH`), each its own statement and transaction, found through the `(occurred_at)` index, so no delete holds the table long. A call that fails part-way has deleted the batches already committed; the next call deletes the rest.

Called by the DAG **`purge_usage_events`** (`jobs/airflow_dags/services/purge_usage_events.py`, task `purge_events`, once a day, one run at a time), through `jobs/tasks/services/usage_purge.py`: one `POST`, sent once with a 15-minute timeout and never retried, so two purges never overlap. The run is red when the call is refused or fails, or does not answer with `deleted` and `before`; the next day's run is the retry. The Airflow image starts a new DAG switched on (`AIRFLOW__CORE__DAGS_ARE_PAUSED_AT_CREATION=False` in `jobs/Dockerfile`), so the purge runs daily from the first deploy that carries it.
