# Data Overview API Specifications (by layer)

## Overview

The task **Data Overview Dashboard** (`data-overview` in the [task catalog](api_specs_tasks.md)) shows IT-Aware's data by the three layers of the target data model: **raw**, **derived**, **transactional** ([data layers](../docs/data-layers.md)). One endpoint gives every table once, placed in the layer it belongs to in the target model, with its row count.

Code: `app/data_overview/` (the service, the routes, the response shape); the layer of each table is `app/data_layers.py`. No table and no migration.

The task's card shows three numbers from the same count pass: Raw, Derived, Transactional ([tasks](api_specs_tasks.md#key-metrics-on-the-task-cards)). The page's older object counts are other routes and are unchanged.

## Today's layer and the target layer

Every table declares what it is today in `app/data_layers.py` (`TABLES`). `target_layer` gives the layer it belongs to in the target model:

| Declared today | Target layer | Why |
|---|---|---|
| `raw` | `raw` | |
| `landing` | `raw` | The older landing area (`staging`), which raw replaces |
| `source_copy` | `derived` | |
| `computed` | `derived` | |
| `mixed` | `derived` | The table stays derived; the marks people set on it move to transactional |
| `transactional` | `transactional` | |

The answer carries both: the layer a table is listed under is the target, and `declared` is today's value, so the page can tag a table that does not match the target yet (`landing`, `mixed`).

## Permission

The route needs what the catalog's `data-overview` task needs for its view: the rule is read from the catalog (`app/tasks/access.py` `rule` and `requirement`, for the view `overview`), not repeated in the route; a catalog without that view stops the backend at start with an error that names it. Today the rule is `ui:navigation:data`. `401` without a sign-in, `403` without the permission.

The count pass is the same for every holder: table names, layers and counts, with no data scope applied, because no row is read. What a caller is **shown** of it depends on whether they are an administrator.

## Sensitive schemas: administrators only

The tables of four schemas are listed only for an administrator: `auth` (who may sign in and do what), `systems` (the platform's own records), `raw` and `staging` (what sources sent, as received). The list is one constant, `SENSITIVE` in `app/data_overview/service.py`.

- **An administrator** is a caller who meets the catalog rule of the first view of the task `access` (Maintain Access, view `accounts`; today `ui:navigation:auth`). The rule is read from the catalog and checked for each request as a route's permission check would (wildcards included); it is not a condition of the route.
- **Anyone else** who holds the page gets the same answer without the groups of those schemas in `groups`.
- **The totals stay whole for everyone**: a layer's `tables`, `rows`, `approximate` and `declared_rows` cover every table, listed or not. They are aggregates and name no table.
- `hidden_tables` says how many of the layer's tables the caller is not shown: `0` for an administrator, and always `tables` minus the tables listed.

Today that hides, for a caller who is no administrator, all 6 tables of the raw layer and 16 of the transactional layer (`auth` 12, `systems` 4); no derived table is in a sensitive schema.

The filter is applied after the cache: the kept answer holds every table and nothing of any account.

## GET /data/layers

No parameters.

```json
{
  "counted_at": "2026-11-12T10:00:00Z",
  "layers": [
    {
      "layer": "raw",
      "tables": 6,
      "rows": 22464,
      "approximate": false,
      "declared_rows": {"raw": 0, "landing": 22464},
      "hidden_tables": 0,
      "groups": [
        {
          "schema": "raw",
          "tables": [
            {"table": "raw.records", "declared": "raw", "rows": 0, "approximate": false, "task": null}
          ]
        },
        {
          "schema": "staging",
          "tables": [
            {"table": "staging.workers", "declared": "landing", "rows": 8187, "approximate": false, "task": null}
          ]
        }
      ]
    },
    {"layer": "derived", "tables": 31, "rows": 528051, "approximate": false,
     "declared_rows": {"source_copy": 100000, "computed": 160000, "mixed": 268051}, "hidden_tables": 0, "groups": []},
    {"layer": "transactional", "tables": 20, "rows": 14769, "approximate": false,
     "declared_rows": {"transactional": 14769}, "hidden_tables": 0, "groups": []}
  ]
}
```

(An administrator's answer. The example shortens the groups; the numbers are illustrative.)

| Field | Type | Meaning |
|---|---|---|
| `counted_at` | datetime (UTC) | When the tables were counted; up to five minutes ago (see the cache) |
| `layers` | list | Always three, in the order `raw`, `derived`, `transactional`, also when a layer has no table |
| `layers[].tables` | int | How many tables the layer has, listed for the caller or not |
| `layers[].rows` | int | The sum of its tables' `rows` that are known (a `null` adds nothing; an estimate is added as it is) |
| `layers[].approximate` | bool | `true` when any of its tables has `approximate: true`, so `rows` is not an exact sum. A table the database does not have does not set it |
| `layers[].declared_rows` | object | The layer's rows by what its tables are declared as today: only the keys the layer has (`raw` and `landing` in raw; `source_copy`, `computed` and `mixed` in derived; `transactional` in transactional), in that order; `{}` for a layer with no table. Complete for every caller, and its values add up to `rows`. The page's raw number is `declared_rows.raw` of the raw layer |
| `layers[].hidden_tables` | int | How many of the layer's tables this caller is not shown (see above); `0` for an administrator |
| `layers[].groups` | list | One per schema, by schema name; without the sensitive schemas unless the caller is an administrator; empty when nothing is listed |
| `groups[].schema` | string | The schema |
| `groups[].tables` | list | Its tables, by name |
| `tables[].table` | string | `schema.table` |
| `tables[].declared` | string | Its layer today: `raw`, `source_copy`, `computed`, `transactional`, `landing` or `mixed` |
| `tables[].rows` | int, null | Its row count; `null` when the database has no such table, or when it was not counted in time and the planner has no estimate |
| `tables[].approximate` | bool | `true` when the table was not counted in time: `rows` is then the planner's estimate, or `null` without one |
| `tables[].task` | string, null | The catalog code of the task a person opens to see the table's records, or `null` |

Every table declared in `app/data_layers.py` appears exactly once. A table the database has and the module does not declare is not listed (`python -m app.data_layers` reports it).

**Counting.** Each table gets an exact `SELECT count(*)`. No column and no row is read, in any layer; for the raw layer this count is the only thing a route does with it. The request's transaction sets `statement_timeout` to 2 s (for that transaction only), and each count runs in its own savepoint: a count that is cancelled (also one waiting on a lock) leaves the others unaffected, and the table gets `pg_class.reltuples`, the planner's estimate, with `approximate: true`. A table that was never analyzed has no estimate: `rows` is `null` and `approximate` is `true`. Which tables exist, and their estimates, come from one read of `pg_class`; a table dropped after that read and before its count is listed as one the database does not have (`rows: null`, `approximate: false`). Any other database error fails the request.

**The whole pass is bounded.** Counting stops 10 s after it started: a table whose turn comes later is not scanned and gets the estimate with `approximate: true`. A count under way at that moment still ends within its own 2 s, so a pass takes about 12 s at most.

**One pass at a time.** Callers who ask while a pass runs wait for that pass and get its answer; a second one is not started (per backend process: two processes can each run one). The pass has a database session of its own and goes on when a caller leaves.

**Cache.** The count pass is kept in Redis for 5 minutes under one key, `data-overview:layers:v1`, with no account in it (`app/clients/redis_cache.py`: without Redis, or when it fails, every call counts). `counted_at` says how old the numbers are.

**The task of a table.** `task` is the same for every caller, also for one who does not hold that task: the page links only the tasks the person has (`GET /tasks/mine`). The map is `TASK_OF` in `app/data_overview/service.py`, reviewed by hand; a unit test fails when a code is not in the catalog or a table is not declared. No raw-layer table has a task.

| Table | Task |
|---|---|
| `activities.incidents` | `it-incidents` |
| `activities.interactions` | `it-interactions` |
| `activities.requests` | `it-requests` |
| `auth.accounts` | `access` |
| `campaigns.notification_batchs` | `notifications` |
| `campaigns.notifications` | `notifications` |
| `campaigns.survey_batchs` | `surveys` |
| `campaigns.surveys` | `surveys` |
| `hierarchies.locations` | `workers` |
| `hierarchies.organizations` | `workers` |
| `hierarchies.service_catalogs` | `it-service-catalog` |
| `insights.worker_clusters` | `workers` |
| `journeys.scenarios` | `it-service-catalog` |
| `knowledges.articles` | `it-knowledge` |
| `networks.ioa_scans` | `it-hardware` |
| `objects.hardwares` | `it-hardware` |
| `objects.systems` | `it-hardware` |
| `objects.workers` | `workers` |
| `systems.job_actions` | `jobs` |
| `systems.usage_events` | `usages` |

## Tests

- Unit: `tests/test_data_layers.py` (the target of each declared layer), `tests/data_overview/` (shaping, counting with a scripted session, the deadline, the map's checks, one caller's answer and the sensitive schemas, the route, its rule, who is an administrator, its cache and callers at once), `tests/tasks/test_access.py` (a view's rule as a route dependency, the error without the view, and whether an account meets a rule).
- Database tier: `tests/db/test_data_overview_db.py` (exact counts on the seeded database, a declared table the database lacks, one dropped before its count, a locked table that falls back to the estimate).
- E2E: `tests/e2e/test_journeys.py` `test_data_by_layer_lists_every_declared_table_once_for_an_administrator` (401, 403, the three layers with every declared table once) and `test_data_by_layer_keeps_the_sensitive_schemas_for_administrators` (a holder who is no administrator: none of the four schemas, `hidden_tables`, whole totals).
