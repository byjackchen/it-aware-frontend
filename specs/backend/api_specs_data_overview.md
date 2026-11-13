# Data Overview API Specifications (by layer)

## Overview

The task **Data Overview Dashboard** (`data-overview` in the [task catalog](api_specs_tasks.md)) shows IT-Aware's data by the three layers of the target data model: **raw**, **derived**, **transactional** ([data layers](../docs/data-layers.md)). One endpoint gives every table once, placed in the layer it belongs to in the target model, with its row count.

Code: `app/data_overview/` (the service, the routes, the response shape); the layer of each table is `app/data_layers.py`. No table and no migration.

The page's older object counts and the card metric `data-overview.records` are unchanged ([tasks](api_specs_tasks.md#key-metrics-on-the-task-cards)).

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

The answer is the same for every holder: table names, layers and counts, with no data scope applied, because no row is read.

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
    {"layer": "derived", "tables": 31, "rows": 528051, "approximate": false, "groups": []},
    {"layer": "transactional", "tables": 20, "rows": 14769, "approximate": false, "groups": []}
  ]
}
```

(The example shortens the groups; the numbers are illustrative.)

| Field | Type | Meaning |
|---|---|---|
| `counted_at` | datetime (UTC) | When the tables were counted; up to five minutes ago (see the cache) |
| `layers` | list | Always three, in the order `raw`, `derived`, `transactional`, also when a layer has no table |
| `layers[].tables` | int | How many tables the layer lists |
| `layers[].rows` | int | The sum of its tables' `rows` that are known (a `null` adds nothing; an estimate is added as it is) |
| `layers[].approximate` | bool | `true` when any of its tables has `approximate: true`, so `rows` is not an exact sum. A table the database does not have does not set it |
| `layers[].groups` | list | One per schema, by schema name; empty when the layer has no table |
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

**Cache.** The answer is kept in Redis for 5 minutes under one key, `data-overview:layers:v1`, with no account in it (`app/clients/redis_cache.py`: without Redis, or when it fails, every call counts). `counted_at` says how old the numbers are.

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
| `insights.analysiss` | `survey-analysis-dashboard` |
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

- Unit: `tests/test_data_layers.py` (the target of each declared layer), `tests/data_overview/` (shaping, counting with a scripted session, the deadline, the map's checks, the route, its rule, its cache and callers at once), `tests/tasks/test_access.py` (a view's rule as a route dependency, and the error without the view).
- Database tier: `tests/db/test_data_overview_db.py` (exact counts on the seeded database, a declared table the database lacks, one dropped before its count, a locked table that falls back to the estimate).
- E2E: `tests/e2e/test_journeys.py` `test_data_by_layer_lists_every_declared_table_once_for_a_holder` (401, 403, the three layers with every declared table once, the same tables for every holder).
