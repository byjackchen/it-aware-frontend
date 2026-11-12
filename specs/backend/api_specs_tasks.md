# Tasks Module API Specifications

## Overview

A **task** is one thing a person can see or do in IT-Aware, named with the words they would type. The **task catalog** lists every task; it is reviewed configuration in this repo (`app/tasks/tasks.json`, beside the grouping list `groupings.json`), changed by a reviewed commit and read once at start. Both files are written from the frozen contract `app/tasks/contract-v3.json` (the task catalog refactor, frozen 2026-11-12) by `scripts/tasks_from_contract.py`; a unit test fails when they disagree with it. It holds 23 tasks in four groupings, with 62 views.

A task has **views**: the pages inside it, which the frontend shows as tabs. Each view has its own permission rule and address. A **grouping** (Data, Analytics, Operations, Administration) only orders and titles tasks: it has no address and no part in access.

Every endpoint answers `404` when the setting `IT_AWARE_TASKS_ENABLED` is `false` (default `true`).

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

Body `{"task": "it-incidents"}`: the task the caller opened. Opening any of a task's views counts as opening the task; the frontend reads the task from the page's address (`/tasks/<task>/…`). The task becomes the caller's most recent. `204` always; a code that is no task of the caller's is not kept. Any other field is refused (`422`).

## Reporting-only check

`uv run python -m app.tasks.checks` prints every API route that names no permission in its declaration.
