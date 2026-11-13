# Manage Jobs API Specifications

## Overview

**Manage Jobs** shows IT-Aware's Airflow jobs (Airflow 3.1, REST API v2) and lets a person control them and recover a run, in three steps: **view**, **control**, **recovery**. The backend calls Airflow as IT-Aware's service account (`app/clients/airflow.py`); the browser never talks to Airflow. Every control and recovery call is recorded in `systems.job_actions` (who, what, which job and run, when, outcome), whatever its outcome.

Code: `app/jobs/` (routes, service, the load, the run policy, the record's model). Migration `0138`.

## Permissions

| Code | Allows |
|---|---|
| `systems:jobs:read` | View: the job list, a job, its runs, a run, a step's log; the load (`GET /jobs/load`); the record (`GET /jobs/actions`) |
| `systems:jobs:run` | Control and recovery: pause, resume, run now, retry failed, stop |

Migration `0138` gives `systems:jobs:read` to every group that held `systems:llm_proxy:read` or `:write`, and `systems:jobs:run` to every group that held `systems:llm_proxy:write`; a group holding `systems:llm_proxy:*` gets both (the groups that saw the older Airflow page). A wider wildcard (`*:*:*`, `systems:*:*`) already matches the new codes.

## Errors

An Airflow failure answers with a code the UI can act on:

```json
{"detail": {"code": "airflow_refused", "message": "Airflow refused IT-Aware's service account this action; it is unavailable here."}}
```

| Status | `code` | When |
|---|---|---|
| 503 | `airflow_unavailable` | Airflow is not configured, or could not be reached |
| 503 | `airflow_refused` | Airflow answered 401 or 403: the service account lacks the role for this action. Show the action as unavailable |
| 404 | `not_found` | Airflow has no such job, run or step |
| 409 | `conflict` | Airflow reported a conflict (its reason in `message`) |
| 422 | `invalid_request` | Airflow did not accept the request (its reason in `message`) |
| 422 | `invalid_parameters` | Run now: a parameter the job does not define |
| 422 | `invalid_id` | A job, run or step id outside Airflow's charsets (Unicode letters and digits, `_ . - : + @`, at least one that is not a dot). FastAPI's own 422 answers first for a path id; `.` and `..` (also as `%2e%2e`) can never reach Airflow. `~` is refused (also as `%7E`) because it is Airflow's "all" wildcard (`/dags/~/dagRuns` lists every job's runs); so a run whose id has a `~` in it can't be opened from IT-Aware (review 2026-11-12) |
| 503 | `record_unavailable` | Control or recovery: the record could not be written, so the action was not done |
| 403 | `manual_run_not_allowed` | Run now: the job is on the run policy's list (below) |
| 403 | `retry_failed_not_allowed` | Retry failed: the job sends messages to people (run policy, below) |
| 502 | `airflow_error` | Any other Airflow error |

Messages never carry Airflow's token or configuration. `401` without a sign-in and `403` without the permission are the usual answers (`detail` a string).

## Run policy

`app/jobs/policy.py` is one reviewed list (changed only by a reviewed commit) naming jobs whose actions IT-Aware refuses, each with its reason and the actions it blocks:

- **run** (run now) is refused for every job in the list;
- **retry_failed** is refused too for a job that sends messages to people, because a retry could send them again (coordinator, 2026-11-12, reversible).

Pause, resume and stop stay allowed for every job, and a listed job keeps its schedule. In the job list each job shows `manual_run_allowed` / `manual_run_refusal` and `retry_failed_allowed` / `retry_failed_refusal`. A refused call answers `403` (`manual_run_not_allowed` or `retry_failed_not_allowed`) before Airflow is asked, and is recorded with outcome `refused`.

| Job | Blocks | Reason |
|---|---|---|
| `services_trigger_notification_batch` | run, retry_failed | Sends a campaign's WeCom messages to people; started by the campaign's own send action, which claims the batch first |
| `sync_workers_erp`, `sync_orgs_erp`, `sync_locations_erp`, `sync_hardwares_erp` | run | Import from ERP, the system of record |
| `sync_servicenow_incidents`, `sync_servicenow_requests`, `sync_servicenow_assessments`, `sync_workers_vip_info` | run | Import from ServiceNow, the system of record |
| `sync_knowledge_articles` | run | Imports from ServiceNow and can wipe the local copy |

## View

### GET /jobs

Every job with its last run. **Fail-soft:** when Airflow cannot be read the answer is `200` with `available: false` and no jobs.

```json
{
  "available": true,
  "base_url_configured": true,
  "jobs": [
    {
      "id": "digest_incidents",
      "name": "digest_incidents",
      "description": "Digest new incidents with an LLM",
      "schedule": "2:00:00",
      "next_run": "2026-11-12T10:00:00Z",
      "paused": false,
      "has_load_errors": false,
      "tags": ["staging", "llm"],
      "last_run": {
        "id": "scheduled__2026-11-12T06:00:00+00:00",
        "state": "success",
        "run_type": "scheduled",
        "run_after": "2026-11-12T08:00:00Z",
        "start": "2026-11-12T08:00:03Z",
        "end": "2026-11-12T08:04:10Z",
        "duration_s": 247.1
      },
      "manual_run_allowed": true,
      "manual_run_refusal": null,
      "retry_failed_allowed": true,
      "retry_failed_refusal": null
    }
  ]
}
```

`schedule` is Airflow's timetable summary; `next_run` is when the next scheduled run may start (Airflow's `next_dagrun_run_after`, else its logical date); `has_load_errors` is true when Airflow could not load the job's file. `last_run` is null for a job with no run. `description` is masked as a log is (below). The newest 100 runs across all jobs are read first; each job not among them is asked for its own newest run. Airflow caps every page at its `[api] maximum_page_limit` (default 100), so the list holds at most 100 jobs and a run at most 100 steps.

### GET /jobs/{id}

One job as in the list, plus the parameters a hand-started run may set (from the job's definition):

```json
{"id": "classify_incidents", "...": "...", "parameters": [
  {"name": "lookback_days", "default": 7, "description": "Days to look back when updated_from is null (default 7).", "schema": {"type": "integer"}}
]}
```

A parameter's `default` and `description` are masked as a run's `parameters` are (review 2026-11-12): a parameter named like a secret (`api_key`, `db_password`) shows its default as `***`, and secrets inside any default or description are replaced as in a log (below). `schema` is passed on as Airflow gives it. The UI's run form therefore never sends a default back: it sends only the values the person changed, and Airflow applies the job's own defaults to the rest.

### GET /jobs/{id}/runs

Query: `limit` (1–100, default 25), `offset` (default 0). Newest first.

```json
{"runs": [{"id": "manual__itaware__2026-11-12T08:30:00+00:00", "state": "running", "run_type": "manual", "run_after": "...", "start": "...", "end": null, "duration_s": null}], "total": 42}
```

### GET /jobs/{id}/runs/{run}

The run (as in the list), with `job_id`, the `parameters` it was started with, and its `steps` (Airflow task instances):

```json
{"id": "scheduled__2026-11-12T06:00:00+00:00", "state": "failed", "...": "...",
 "job_id": "digest_incidents", "parameters": {},
 "steps": [{"id": "digest", "name": "digest", "map_index": -1, "state": "failed", "start": "...", "end": "...", "duration_s": 12.5, "try_number": 2}]}
```

A run id holds characters such as `:` and `+`: encode it in the path.

### GET /jobs/{id}/runs/{run}/steps/{step}/log

Query: `try` (the try number, default 1), `map_index` (default -1; a mapped step's index), `token` (to read on, from `next_token`).

```json
{"job_id": "digest_incidents", "run_id": "...", "step_id": "digest", "try_number": 2,
 "content": "[2026-11-12T08:00:03Z] starting\n...", "truncated": false, "next_token": null}
```

The log is joined into text. When it is longer than 200,000 characters only its end is returned and `truncated` is true. Values that look like secrets are replaced with `***`: credentials in a URI (`scheme://user:***@host`; the secret runs to the last `@` before the host, so one with `@` or `/` in it is masked whole, and it stops at a quote, a space, `?` or `#`), an `Authorization` scheme (`Basic ***`, `Bearer ***`), and the value of a key naming a secret (`password`, `passwd`, `secret`, `token`, `api_key`, `fernet_key`, `private_key`, `credential`, and keys containing them). A quoted value is masked whole, spaces and all; an unquoted one runs on over spaces to the end of the line (`password = my pass` masks to `password = ***`), stopping at `,`, `;`, `}`, a quote, or before the next `key=` / `key:`, which is masked on its own. (Both widened in review 2026-11-12.) Token counts such as `max_tokens=` are kept. The same key rules mask a run's `parameters` (run detail) and the parameters stored in the record.

### GET /jobs/load

The load and time consumed: how many runs started in the last days and how long they ran, in total, per day, per hour of the day and per job (`app/jobs/load.py`). It is the page of the task's second view, Load (`/tasks/jobs/load`); the view requires what the Jobs view requires (`ui:navigation:systems`), the endpoint `systems:jobs:read`.

Query: `days`, one of `7`, `30`, `90` (default `7`); anything else is `422`. The window is that many UTC days ending today, today included.

```json
{"days": 7, "start": "2026-11-06", "end": "2026-11-12",
 "partial": false, "runs_read": 412,
 "totals": {"runs": 412, "failed": 3, "run_seconds": 18234.5, "average_seconds": 44.3,
            "longest": {"job": "sync_workers_erp", "run_id": "scheduled__2026-11-09T02:00:00+00:00", "seconds": 912.0}},
 "daily":  [{"date": "2026-11-06", "success": 55, "failed": 1, "other": 0, "run_seconds": 2400.0}],
 "hourly": [{"hour": 0, "runs": 12, "run_seconds": 300.0}],
 "jobs":   [{"job": "sync_workers_erp", "runs": 7, "failed": 0, "run_seconds": 5200.0,
             "average_seconds": 742.9, "longest_seconds": 912.0}]}
```

- **Which runs.** The runs of every job that **started** in the window, read from Airflow's all-jobs listing (`GET /api/v2/dags/~/dagRuns` with `start_date_gte` the window's first midnight UTC, `start_date_lte` the moment of asking, `order_by=-start_date`), 100 a page, the pages after the first four at a time, all with one Airflow token (one sign-in to Airflow per read). A run that has not started (queued) is not in it. Only a run's job id, run id, state, start and end are used: no parameters, conf or log is read. Job ids go out as Airflow gives them. A run listed on two pages (one that moved while the pages were read) is counted once, by job id and run id; an item in the listing that is not a run is skipped.
- **Seconds.** A `success` or `failed` run with an end has a time: its seconds are end − start. A `failed` run with no end counts as `failed` with no time. Any other run (queued, running, a `success` with no end, or one whose end is before its start) counts as `other` with no time. A run with no time adds 0 seconds and is left out of the averages and the longest. Every seconds value is rounded to a tenth.
- **`totals`.** `runs` every run counted, `failed` the failed ones, `run_seconds` the sum, `average_seconds` the mean over the runs with a time (`null` when there is none), `longest` the longest of them (`null` when none; of equally long runs the first by job id, then run id).
- **`daily`.** One entry per UTC day of the window, oldest first, days without runs included (zeros). A run counts on the day it started.
- **`hourly`.** Always 24 entries, `hour` 0 to 23: the UTC hour a run started in, summed over the whole window.
- **`jobs`.** Every job with at least one run in the window, by `run_seconds`, most first, then by job id. `average_seconds` and `longest_seconds` are over its runs with a time, `null` when it has none.
- **The bound.** At most 20,000 runs are read (200 pages). When Airflow has more in the window, `partial` is `true` and `runs_read` is the number read: the newest, so the most recent days are complete and the oldest days are short or empty. Otherwise `runs_read` equals `totals.runs`.
- **The time bound.** One read of Airflow takes at most 45 seconds in all, and each request of it (the sign-in, a page) at most 15. A page that fails stops the pages still being read. Past either bound the answer is the fail-soft one below.
- **Kept for 5 minutes.** The answer is cached in Redis for 300 seconds under a key that names only the window (`jobs:load:v1:<days>:<end date>`): it is the same for every holder of `systems:jobs:read` and holds nothing about the caller. So a run that just finished can take up to 5 minutes to show. Callers who ask for the same window while it is being read (in the same backend process) wait for that one read instead of starting another. Without Redis each call after it reads Airflow again.
- **Fail-soft**, as the job list is. When Airflow cannot be read (not configured, unreachable, refusing the service account, answering an error, or too slow) the answer is `200` with only:

```json
{"available": false, "base_url_configured": true}
```

`base_url_configured` is `false` when no Airflow address is set. A normal answer has no `available` key; an unavailable answer is never cached.

`/jobs/load` is this read, never a job: a job whose id is literally `load` cannot be opened at `GET /jobs/load` (as one named `actions` cannot at `GET /jobs/actions`); its runs, a run and its controls (`/jobs/load/runs`, …) still answer.

**A job's own durations** need no further endpoint: `GET /jobs/{id}/runs` (above) already answers each run's `state`, `start`, `end` and `duration_s`, up to 100 a page (`limit=30` for the last 30 runs), newest first.

## Control and recovery (`systems:jobs:run`; each call recorded)

Each answers with the record row it wrote (as in `GET /jobs/actions`). The row is written as `pending` **before** Airflow is asked (an action that cannot be recorded is not done: `503 record_unavailable`), then set to `succeeded` or `failed`. When that last write fails, or the request is cut off while Airflow works, the row stays `pending` and the action's own answer or error still stands: the session is rolled back, and the answer is built from the values in hand, never read back from the row. A policy refusal is written once, as `refused`; a lost refusal record never hides the 403.

| Endpoint | Airflow call |
|---|---|
| `POST /jobs/{id}/pause` | `PATCH /api/v2/dags/{id}` `{"is_paused": true}` |
| `POST /jobs/{id}/resume` | `PATCH /api/v2/dags/{id}` `{"is_paused": false}` |
| `POST /jobs/{id}/runs` | `POST /api/v2/dags/{id}/dagRuns` with run id `manual__itaware__<UTC time>`; answers `201` |
| `POST /jobs/{id}/runs/{run}/retry-failed` | `POST /api/v2/dags/{id}/dagRuns/{run}/clear` `{"dry_run": false, "only_failed": true}`: the failed steps run again |
| `POST /jobs/{id}/runs/{run}/stop` | `PATCH /api/v2/dags/{id}/dagRuns/{run}` `{"state": "failed"}`: the run is marked failed and what is left of it stops |

`POST /jobs/{id}/runs` body (optional): `{"parameters": {"lookback_days": 3}}`. A name the job does not define is refused (`422 invalid_parameters`); values are checked by Airflow against the job's parameter schema (`422 invalid_request`). A job on the run policy's list is refused (`403 manual_run_not_allowed`) before Airflow is asked, and the refusal is recorded. The trigger is retried with the same run id after a lost answer; a `409` on it is read back, and when the run exists the call counts as succeeded.

## Record

### GET /jobs/actions

Query: `job_id` (optional), `limit` (1–200, default 50), `offset`. Newest first.

```json
{"actions": [{"id": "AZPx…", "account_oid": "AZPw…", "username": "some.person", "action": "run",
  "job_id": "classify_incidents", "run_id": "manual__itaware__2026-11-12T08:30:00+00:00",
  "parameters": {"lookback_days": 3}, "requested_at": "2026-11-12T08:30:00Z",
  "outcome": "succeeded", "error": null}], "total": 1}
```

`action`: `pause`, `resume`, `run`, `retry_failed`, `stop`. `outcome`: `pending` (written before Airflow was asked; its answer was lost or could not be written); `succeeded`; `failed` (Airflow refused or could not be reached; `error` holds the code and message); `refused` (the run policy). Rows are only added; the account is kept by oid and username, so a row outlives its account.

## The older list

`GET /systems/airflow/dags` (`systems:jobs:read`) answers the job list in the shape of the older LLM Proxy tab (`{available, base_url_configured, dags: [{dag_id, display_name, is_paused, has_import_errors, schedule, tags, last_run_id, last_run_state, last_run_start, last_run_end, last_run_duration_s}]}`). It is kept only until the frontend uses `GET /jobs`, then removed.
