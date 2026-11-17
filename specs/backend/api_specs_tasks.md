# Tasks Module API Specifications

## Overview

A **task** is one thing a person can see or do in IT-Aware, named with the words they would type. The **task catalog** lists every task; it is reviewed configuration in this repo (`app/tasks/tasks.json`, beside the grouping list `groupings.json`), changed by a reviewed commit and read once at start. Both files are written from the frozen contract `app/tasks/contract-v3.json` (the task catalog refactor, frozen 2026-11-12) by `scripts/tasks_from_contract.py`; a unit test fails when they disagree with it. It holds 24 tasks in four groupings, with 67 views. Every task has an **icon** (added to the contract copy on 2026-11-12, maintainer's choice: an icon per task; see [the icons](#icons)). Added to the contract copy after it was frozen, with no old code and no legacy address: the task `usages` (View Usages, migration 0140; its API is in [usage](api_specs_usage.md); its view `people`, By Person / 按人员, at `/tasks/usages/people`, came later, between `tasks` and `unused-access`, with the same rule, `systems:usage:read`), and the view `load` (Load / 负载, `/tasks/jobs/load`; it requires what the task's Jobs view requires, `ui:navigation:systems`, so a person has both tabs or neither; its API, `GET /jobs/load` in [jobs](api_specs_jobs.md), is gated by `systems:jobs:read` like the other job reads) of the task `jobs`. With its second view, Manage Jobs' first view moved from `/tasks/jobs` to `/tasks/jobs/jobs` (the address rule for a task with several views), and the legacy addresses `/systems` and `/systems/airflow` point there. One task was renamed after the freeze: `survey-link` (Find Survey Link) is `it-csat-link`, **Find IT CSAT Link** / 查找 IT CSAT 链接, at `/tasks/it-csat-link`, with CSAT keywords and its view named CSAT Lookup; the name says IT, so the code starts with `it-`. Its permissions, its view's slug (`lookup`) and its legacy entry (`/ssc-cockpit/survey-lookup`, now pointing at the new address) are unchanged. Migration 0141 rewrites the saved code in `auth.account_home` (pinned, recent), `auth.account_profiles` (start task, home tasks) and `systems.usage_events` (task). `/tasks/survey-link` was never deployed, so it has no redirect.

A task has **views**: the pages inside it, which the frontend shows as tabs. Each view has its own permission rule and address. A **grouping** (Data, Analytics, Operations, Administration) only orders and titles tasks: it has no address and no part in access.

## The task contract

| Field | Type | Meaning |
|---|---|---|
| `code` | string | Stable key, lower case with hyphens (`it-tickets`). It is the task part of every address |
| `name` | `{en, zh}` | The task's name, following the naming convention below |
| `grouping` | string | A grouping code: `data`, `analytics`, `operations` or `administration` |
| `kind` | `internal` \| `external` | `internal`: page and backend are IT-Aware's. `external`: the task opens another app (`external_app`), reached through this backend's gateway for that app ([external tasks](#external-tasks)) |
| `external_app` | string \| null | The other app, for an `external` task; null otherwise |
| `address` | string | Where the task opens: its first view's address |
| `icon` | string | The lucide icon the frontend draws it with, lowercase kebab-case; required ([icons](#icons)) |
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

Whether a task shows something or changes something is not stored: it follows from the leading verb of the English name (View, Find, Monitor, and names ending Dashboard or Report show; Maintain, Manage, Create, Edit, Send, Import change). An external task may instead be named after the app it opens, as people know it, and then counts as one that changes something (maintainer, 2026-11-17: **Ohla Router**, then **Ohla Knowledge**, **Ohla Journey** and **Ohla Sidebar**).

The catalog refuses to load when an internal task's name starts with no known verb and ends with neither Dashboard nor Report, when two tasks share a name in either language, when a name names a team, when a code starts with `it-` and the English name does not say "IT" or the other way round, or when an address does not follow the rule above.

## External tasks

An external task opens another app's own interface inside IT-Aware. IT-Aware decides who has the task, by its view's rule like any other task; the app then decides what the person may do there, by the role it gives them. The seam each app implements: iWiki 4061914677, section 3. The tasks (ohla-xray TODO00000164), each with `external_app` equal to its code and one view needing `external:<app>:use`, which the `admins` group holds:

| Task | Grouping | Icon | View rule | Migration | Address and key settings | Never forwarded |
|---|---|---|---|---|---|---|
| **Ohla Router** (`ohla-router`, 2026-11-17) | Administration | `waypoints` | `external:ohla_router:use` | 0152 | `ROUTER_BASE_URL`, `ROUTER_DELEGATION_PRIVATE_KEY` | `admin/api/login`, `admin/api/logout`, `v1/...` (model calls take a Consumer key) |
| **Ohla Knowledge** (`ohla-knowledge`, 2026-11-17) | Operations | `brain` | `external:ohla_knowledge:use` | 0156 | `OHLA_KNOWLEDGE_URL`, `OHLA_KNOWLEDGE_DELEGATION_PRIVATE_KEY` | `v1/auth/...` (sign-in, device and OAuth flows) |
| **Ohla Journey** (`ohla-journey`, 2026-11-17) | Analytics | `footprints` | `external:ohla_journey:use` | 0156 | `OHLA_JOURNEY_URL`, `OHLA_JOURNEY_DELEGATION_PRIVATE_KEY` | nothing more |
| **Ohla Sidebar** (`ohla-sidebar`, 2026-11-17) | Administration | `panel-right` | `external:ohla_sidebar:use` | 0156 | `OHLA_SIDEBAR_URL`, `OHLA_SIDEBAR_DELEGATION_PRIVATE_KEY` | nothing more |

Knowledge, Journey and the Sidebar are unset in every environment until each app has its side: their tasks say they are not set up.

### ANY /external/{task}/{path}

One route per external task (`app/external_tasks/gateway.py`). `GET`, `POST`, `PUT` and `DELETE`. The frontend frames the app's interface from IT-Aware's own origin, and every request the framed page makes, for the page and for the app's API, comes here.

- **Who.** A signed-in `user` account that meets the task's view rule: `401` without a sign-in, `403` without the code, and `403` for an integration account, since the app acts for people.
- **What is forwarded.** Everything but the app's paths in the table above, and all below them, which answer `404`, as does a path with an empty, `.` or `..` part. A body over 10 MiB is `413`.
- **How.** The request goes to the app's origin, taken from its address setting, with its query, its body and its `Accept`, `Content-Type` and `If-None-Match` headers, and nothing else of the caller's: no cookie. It carries `Authorization: Bearer <token>`, a JWT signed RS256 with the app's private key setting (a key pair of its own per app, not the sign-in key): `iss` `it-aware`, `sub` the account's username, `aud` the task's code, `iat`, `exp` one minute later, and a `jti`. The app checks it with the public half and applies the person's role there.
- **The answer.** The app's status and body unchanged, with only the headers a page needs: `Content-Type`, `Cache-Control`, `ETag`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Retry-After`, `Allow`. The app's own refusals (Router's `401 invalid_delegation`, `403 no_standing`, `403 role_required`) come back as they are.
- **Not configured.** Without the app's address or key the answer is `503`; the app unreachable is `502`.

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

The signed-in person's home, their own pins and their recent tasks. Pins and recents are stored per account in `auth.account_home`; the tasks an admin set come from the groups the person is in (`home_tasks` of each group, `/auth/config/groups/{oid}` in `api_specs_auth.md`, since migration 0153; before it, from a per-account profile with a start task, both removed). Every list holds only tasks the person has now: a stored code they no longer have is left out, not deleted. Codes saved before the catalog v3 were moved to the new task codes by migration 0137 (each old page's code to the task that holds that page; repeats, retired and unknown codes dropped).

### GET /tasks/home

```json
{
  "admin_set": ["<task>"],
  "pinned": ["<task>"],
  "recent": ["<task>"],
  "other": ["<task>"]
}
```

- `admin_set`: the home tasks of the person's groups: group by group in the order of their names, each group's in the admin's order, a task named by two groups shown once, where it comes first. A task's `address` (in the lists, or `GET /tasks/mine`) is where it opens for them.
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

A **metric** is one number a task's own page already computes, shown on the task's card. The **metric registry** is reviewed code (`app/tasks/metrics.py`), checked once when first read: at most three metrics per task, in the order the card shows them, each naming a task of the catalog. A metric has no definition of its own: it calls the page's computation and takes one number from the result.

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
| `data-overview.raw` | `data-overview` | count | now | Label "Raw" / "原始". The rows of the tables declared `raw` in `app/data_layers.py` (today `raw.records`). The older landing tables (`landing`) are **not** in this number. It is 0 while raw is not in use, and 0 is stored and returned like any value |
| `data-overview.derived` | `data-overview` | count | now | Label "Derived" / "派生". The rows of the tables declared `source_copy`, `computed` or `mixed` |
| `data-overview.transactional` | `data-overview` | count | now | Label "Transactional" / "事务". The rows of the tables declared `transactional` |

The three Data Overview numbers come from one count pass, the one behind the page's tables by layer ([data overview](api_specs_data_overview.md)): each is the sum of `declared_rows` for its declared layers, so a table counted by estimate adds its estimate and an uncounted one adds nothing. They need what the page itself needs, the rule of its view in the catalog (today `ui:navigation:data`), and nothing else. They replaced `data-overview.records` (the sum of eleven object lists): its stored rows stay in `metrics.metric_values` and are no longer returned.

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

## Icons

`icon` is a field of every task, in the contract copy, `tasks.json` and every answer that carries a task (`GET /tasks/catalog`, `/tasks/mine`, `/tasks/access`, `/tasks/home`); it was added to them, nothing else changed. It names the icon the frontend draws the task with: a [lucide](https://lucide.dev/icons/) icon name, as `lucide-react` takes it in kebab-case. The catalog refuses a task without one, and one that is not lowercase kebab-case (`^[a-z][a-z0-9]*(-[a-z0-9]+)*$`). No two tasks share one (`tests/tasks/test_catalog.py`).

| Task | Icon |
|---|---|
| `workers` | `users` |
| `it-incidents` | `triangle-alert` |
| `it-requests` | `clipboard-list` |
| `it-interactions` | `messages-square` |
| `it-service-catalog` | `book-open` |
| `it-hardware` | `monitor` |
| `data-overview` | `layers` |
| `it-knowledge` | `library` |
| `it-operations-dashboard` | `gauge` |
| `ohla-chatbot-dashboard` | `bot` |
| `ohla-journey-dashboard` | `route` |
| `it-ssc-dashboard` | `headset` |
| `persona-dashboard` | `user-round-search` |
| `it-tickets` | `ticket` |
| `it-aging-work` | `hourglass` |
| `it-assets` | `package` |
| `notifications` | `bell` |
| `surveys` | `clipboard-check` |
| `it-csat-link` | `link` |
| `access` | `key-round` |
| `jobs` | `timer` |
| `agent-access` | `terminal` |
| `usages` | `chart-no-axes-column` |

Whether each name exists in the `lucide-react` version the frontend installs is the frontend's to check: `triangle-alert`, `user-round-search` and `chart-no-axes-column` are names of newer lucide releases.
