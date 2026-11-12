# Tasks Module API Specifications

## Overview

A **task** is one thing a person can see or do in IT-Aware, named with the words they would type. The **task catalog** lists every task; it is reviewed configuration in this repo (`app/tasks/tasks.json`, beside the service-line list `service_lines.json`), changed by a reviewed commit and read once at start. Its first content was imported once from the frontend's menu on 2026-11-12 (`scripts/tasks_import_menu.py`): one task per menu entry, 63 in all.

Both endpoints answer `404` when the setting `IT_AWARE_TASKS_ENABLED` is `false` (default `true`).

## The task contract

| Field | Type | Meaning |
|---|---|---|
| `code` | string | Stable key, dotted lower case (`data.incidents`) |
| `name` | `{en, zh}` | The task's name |
| `area` | `{en, zh}` | The part of the product it sits in |
| `keywords` | string[] | Extra words to find it by |
| `kind` | `view` \| `do` | Whether the task shows something or changes something |
| `origin` | `it_aware` \| `external` | `it_aware`: page and backend are IT-Aware's. `external`: the page is in IT-Aware's frontend and its backend is another app, not reached through this backend |
| `external_app` | string \| null | The other app, for an `external` task; null otherwise |
| `service_line` | string | A code from the service-line list (today only `it`) |
| `requires` | `{check, codes}` | The permission codes the task needs: `check` is `any` (one of them) or `all` |
| `opens` | string | The address of the task's page in the frontend |

## Who has a task

An account has a task when the permission codes of its counted groups meet the task's `requires`, with `*` matching any domain, resource or action. Groups count as in `GET /auth/me`: a `self_scoped` or `role_based` group counts only for a `user` account linked to a worker. Data scope does not hide a task; each task is reported with `scopes`, the scope types of the groups that grant any of its codes.

## Endpoints

### GET /tasks/mine

The caller's tasks, in catalog order. Any signed-in account.

```json
{
  "tasks": [
    {
      "task": {
        "code": "data.incidents",
        "name": {"en": "Incidents", "zh": "事件"},
        "area": {"en": "Data", "zh": "数据"},
        "keywords": ["Activities", "活动"],
        "kind": "view",
        "origin": "it_aware",
        "external_app": null,
        "service_line": "it",
        "requires": {"check": "all", "codes": ["ui:navigation:data", "objects:incidents:read"]},
        "opens": "/data/incidents"
      },
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
  "service_lines": [{"code": "it", "name": {"en": "IT", "zh": "IT"}}],
  "tasks": ["<the whole catalog, as above>"],
  "groups": [
    {"name": "admins", "scope_type": "unconstrained", "tasks": ["auth.permissions", "data.incidents"]}
  ],
  "accounts": [
    {
      "username": "some.user",
      "account_type": "user",
      "is_active": true,
      "groups": ["admins"],
      "tasks": [{"code": "data.incidents", "scopes": ["unconstrained"]}]
    }
  ]
}
```

A group's `tasks` are those its own permissions grant. An account's `groups` lists every group it is in, including a scoped group that does not count for it. `401` without a sign-in, `403` without the two permissions.

## Reporting-only check

`uv run python -m app.tasks.checks` prints every API route that names no permission in its declaration.
