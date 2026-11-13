# Tasks Module API Specifications

## Overview

A **task** is one thing a person can see or do in IT-Aware, named with the words they would type. The **task catalog** lists every task; it is reviewed configuration in this repo (`app/tasks/tasks.json`, beside the grouping list `groupings.json`), changed by a reviewed commit and read once at start. Both files are written from the frozen contract `app/tasks/contract-v3.json` (the task catalog refactor, frozen 2026-11-12) by `scripts/tasks_from_contract.py`; a unit test fails when they disagree with it. It holds 24 tasks in four groupings, with 65 views. One task was added to the contract copy after it was frozen: `usages` (View Usages, migration 0140; its API is in [usage](api_specs_usage.md)); it has no old code and no legacy address.

A task has **views**: the pages inside it, which the frontend shows as tabs. Each view has its own permission rule and address. A **grouping** (Data, Analytics, Operations, Administration) only orders and titles tasks: it has no address and no part in access.

## The task contract

| Field | Type | Meaning |
|---|---|---|
| `code` | string | Stable key, lower case with hyphens (`it-tickets`). It is the task part of every address |
| `name` | `{en, zh}` | The task's name, following the naming convention below |
| `grouping` | string | A grouping code: `data`, `analytics`, `operations` or `administration` |
| `kind` | `internal` \| `external` | `internal`: page and backend are IT-Aware's. `external`: the page is in IT-Aware's frontend and its backend is another app, not reached through this backend |
| `external_app` | string \| null | The other app, for an `external` task; null otherwise |
| `address` | string | Where the task opens: its first view's address |
| `keywords` | string[] | Extra words to find the task by |
| `views` | view[] | The pages inside it, in order; at least one |

A view:

| Field | Type | Meaning |
|---|---|---|
| `slug` | string | Unique inside the task, lower case with hyphens |
| `name` | `{en, zh}` | The view's name |
| `keywords` | string[] | Extra words to find the task at this view by |
| `requires` | `{check, codes}` | The permission codes the view needs: `check` is `any` (one of them) or `all` |
| `address` | string | `/tasks/<task>` for a task with one view, `/tasks/<task>/<slug>` otherwise. A record or sub-page follows it: `/tasks/it-incidents/<oid>` |

Whether a task shows something or changes something is not stored: it follows from the leading verb of the English name (View, Find, Monitor, and names ending Dashboard or Report show; Maintain, Manage, Create, Edit, Send, Import change).

The catalog refuses to load when a name starts with no known verb and ends with neither Dashboard nor Report, when two tasks share a name in either language, when a name names a team, when a code starts with `it-` and the English name does not say "IT" or the other way round, or when an address does not follow the rule above.

## Who has a task

An account has a task when the permission codes of its counted groups meet the `requires` of **any** of the task's views, with `*` matching any domain, resource or action. It sees only the views whose rule it meets: in `/tasks/mine`, `/tasks/home` and search, each task carries only those views, and its `address` is the first of them. Groups count as in `GET /auth/me`: a `self_scoped` or `role_based` group counts only for a `user` account linked to a worker. Data scope does not hide a task; each task is reported with `scopes`, the scope types of the groups that grant any code of the views the account has.

## Endpoints

### GET /tasks/catalog

The whole catalog: the groupings, and every task with all its views, as in the contract. Any signed-in account. The frontend's drift test compares it with its own copy of the contract.

```json
{
  "groupings": [{"code": "operations", "name": {"en": "Operations", "zh": "运营"}}],
  "tasks": [
    {
      "code": "it-tickets",
      "name": {"en": "Monitor IT Tickets", "zh": "监控 IT 工单"},
      "grouping": "operations",
      "kind": "internal",
      "external_app": null,
      "address": "/tasks/it-tickets/active",
      "keywords": [],
      "views": [
        {
          "slug": "active",
          "name": {"en": "Active Monitoring", "zh": "实时监控"},
          "keywords": ["Monitoring", "监控"],
          "requires": {"check": "any", "codes": ["ui:navigation:operation"]},
          "address": "/tasks/it-tickets/active"
        }
      ]
    }
  ]
}
```

`401` without a sign-in.

### GET /tasks/mine

The caller's tasks, in catalog order, each with only the views the caller has. Any signed-in account.

```json
{
  "tasks": [
    {
      "task": "<a task, as in GET /tasks/catalog, with only the caller's views>",
      "scopes": ["unconstrained"]
    }
  ]
}
```

`401` without a sign-in.

### GET /tasks/access

Who has what tasks. Requires both `auth:account_groups:read` and `auth:group_permissions:read`.

```json
{
  "groupings": ["<as in GET /tasks/catalog>"],
  "tasks": ["<the whole catalog, as in GET /tasks/catalog>"],
  "groups": [
    {"name": "admins", "scope_type": "unconstrained", "tasks": ["workers", "it-incidents"]}
  ],
  "accounts": [
    {
      "oid": "<the account's oid>",
      "username": "some.user",
      "account_type": "user",
      "is_active": true,
      "groups": ["admins"],
      "tasks": [{"code": "it-incidents", "scopes": ["unconstrained"]}]
    }
  ]
}
```

A group's `tasks` are those its own permissions grant. An account's `groups` lists every group it is in, including a scoped group that does not count for it. `401` without a sign-in, `403` without the two permissions.

## The home page (Tasks 3)

The signed-in person's home, their own pins and their recent tasks. Pins and recents are stored per account in `auth.account_home`; the tasks an admin set come from the profile (`/auth/config/accounts/{oid}/profile`, in `api_specs_auth.md`), which the person never reads. Every list holds only tasks the person has now: a stored code they no longer have is left out, not deleted. Codes saved before the catalog v3 were moved to the new task codes by migration 0137 (each old page's code to the task that holds that page; repeats, retired and unknown codes dropped).

### GET /tasks/home

```json
{
  "start": "it-incidents",
  "admin_set": ["<task>"],
  "pinned": ["<task>"],
  "recent": ["<task>"],
  "other": ["<task>"]
}
```

- `start`: the code of the profile's start task, when one is set and the person has it; otherwise `null`, and the person lands on the home page. The task's `address` (in the lists, or `GET /tasks/mine`) is where it opens for them.
- `admin_set`: the profile's home tasks, in the admin's order. Empty while `IT_AWARE_PROFILES_ENABLED` is off.
- `pinned`: in the order pinned. `recent`: the last opened first, at most 8.
- `other`: the person's tasks that are neither set by the admin nor pinned, in catalog order.

Each `<task>` is a task as in `GET /tasks/mine`: with only the person's views. `401` without a sign-in.

### PUT /tasks/pins/{code}, DELETE /tasks/pins/{code}

Pin or unpin a task for the caller. `204`. `PUT` answers `404` for a code that is not a task the caller has. Both can be repeated.

### POST /tasks/recent

Body `{"task": "it-incidents", "view": "incidents"}`: the task the caller opened, and the slug of the view they opened it at. `view` is optional. Opening any of a task's views counts as opening the task; the frontend reads the task and the view from the page's address (`/tasks/<task>/…`). The task becomes the caller's most recent. `204` always; a code that is no task of the caller's is not kept. Any other field is refused (`422`).

Each call also writes one **usage event** (`task_open`, in `systems.usage_events`: the account, the task, the view and the time; see [usage](api_specs_usage.md)):

- only for a task the caller has; a code that is no task of theirs writes none;
- a `view` that is not one of the caller's views of that task is stored as no view (`null`); the open still counts;
- the same account, task and view again within 60 seconds is the page drawn again, not a new open, and writes none (a missing `view` is compared as one value);
- fail-soft: an event that cannot be written is logged by its kind and the answer is still `204`. It is written after the recents, inside a savepoint of the same session, and gives up after 250 ms on a lock.

## Key metrics on the task cards

A **metric** is one number a task's own page already computes, shown on the task's card. The **metric registry** is reviewed code (`app/tasks/metrics.py`), checked once when first read: at most two metrics per task, in the order the card shows them, each naming a task of the catalog. A metric has no definition of its own: it calls the page's computation and takes one number from the result.

| Metric | Task | Unit | Period | The number, and where the page computes it |
|---|---|---|---|---|
| `it-tickets.active` | `it-tickets` | count | now | `totalActive` of the hub report (`GET /dashboards/ops/hub`) |
| `it-tickets.unassigned` | `it-tickets` | count | now | `unassigned` of the hub report |
| `it-operations-dashboard.incident-sla-met` | `it-operations-dashboard` | percent | month | Completed incident SLAs not breached / completed incident SLAs: the "all SLA" cell of the incident SLA report, for the calendar month |
| `ohla-chatbot-dashboard.interactions` | `ohla-chatbot-dashboard` | count | last_7_days | `total_interactions` of the overview (`GET /dashboards/chatbot/overview`) |
| `ohla-chatbot-dashboard.users` | `ohla-chatbot-dashboard` | count | last_7_days | `distinct_users` of the overview |
| `it-ssc-dashboard.interactions` | `it-ssc-dashboard` | count | month | `grand_total` of the FAQ month report |
| `it-ssc-dashboard.visitors` | `it-ssc-dashboard` | count | month | `unique_visitors` of the FAQ month report |
| `jobs.failed` | `jobs` | count | now | Jobs in `GET /jobs` whose last run's state is `failed` |
| `data-overview.records` | `data-overview` | count | now | The sum of the unfiltered totals of the eleven lists the Data Overview page counts (organizations, locations, service catalogs, workers, articles, incidents, requests, interactions, survey batches, notification batches, analyses) |

Periods are UTC days: `now` is the day of the refresh, `month` the calendar month, `last_7_days` the day of the refresh and the six before it. The SSC page itself picks its month from the server's local date (as it did before the metrics), so around a month's end the card and the page can show different months for some hours; the numbers of one month are the same in both.

**Stored values.** `metrics.metric_values` (migration 0139) holds one row per metric, period and dimension: `metric_code`, `period_start`, `period_end`, `dimension_type`, `dimension_key`, `numerator`, `denominator` (set for a percent), `value`, `computed_at`, `definition_version`; those first five columns are its key. Every row today is the whole organization's: `dimension_type` `organization`, `dimension_key` empty. The refresh upserts the row of the period that is running. For a `month` and a `last_7_days` metric it also computes the period right before again and upserts that row, so data that arrived after the period ended is in the value the card compares with. A `now` metric is a snapshot of its day and cannot be taken again: a day that has ended keeps its last value.

**Who sees a metric.** The stored number is the whole organization's, so a caller gets a metric only when both hold: they have its task (as in `GET /tasks/home`), and every permission the number is computed from reaches them through an `unconstrained` counted group. A person who holds the task with a `self_scoped` or `role_based` scope on that data gets no number.

### GET /tasks/metrics

```json
{
  "metrics": [
    {
      "task": "it-tickets",
      "code": "it-tickets.active",
      "label": {"en": "Active tickets", "zh": "活跃工单"},
      "unit": "count",
      "value": 41,
      "period": {"start": "2026-11-12", "end": "2026-11-12", "kind": "now"},
      "previous_value": 38,
      "computed_at": "2026-11-12T10:00:04.512Z"
    }
  ]
}
```

- Only the caller's metrics, in registry order. `401` without a sign-in.
- `unit` is `count` (an integer `value`) or `percent` (0 to 100, one decimal). `period.kind` is `now`, `month` or `last_7_days`.
- Only the row of the period that is running now is shown. A metric with no such row (not refreshed yet in this period, or no value yet), or whose row was computed more than 24 hours ago, is left out; an earlier period's row is never shown in its place. So a `now` metric is absent from the start of a UTC day until that day's first refresh.
- `previous_value`: the value of the period right before (the day before, the month before, the seven days before), when that row exists and was computed with the same `definition_version`; otherwise `null`.

### POST /tasks/metrics/refresh

Computes every registered metric for the whole organization and upserts its row. Needs `systems:jobs:run`; the hourly job `refresh_task_metrics` calls it with the job account. `401` without a sign-in, `403` without the permission.

```json
{"enabled": true, "refreshed": ["it-tickets.active"], "kept": {"jobs.failed": "failed: RuntimeError"}}
```

- `enabled`: always `true`. The switch it reported is retired; the field is kept so the answer's shape does not change.
- `refreshed`: the metrics whose row was written.
- `kept`: the metrics that kept their last row, each with why: `no value` (a rate with nothing to count yet) or `failed: <error type>` (the cause is in the backend log). One metric failing does not stop the others; when Airflow cannot be read, `jobs.failed` is kept. A page computation two metrics share runs once per refresh, also when it fails.

**The job.** `refresh_task_metrics` sends this call once an hour, once per run, with a 15-minute timeout and no second send (two refreshes must not run at a time); a failed run is not retried, the next hour's run is. The run is red when the call fails or is refused, when any `kept` reason is a failure, or when `refreshed` is empty; `no value` alone is not a failure.

## Reporting-only check

`uv run python -m app.tasks.checks` prints every API route that names no permission in its declaration.
