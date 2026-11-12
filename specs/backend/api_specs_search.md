# Search API Specifications

## Overview

`GET /search` is one search over several providers. Stage 1 (Tasks 2) has two: **tasks**, from the task catalog ([tasks](api_specs_tasks.md)), and **records**, from the global registry index ([registry](api_specs_objects_registry.md)). It answers `404` when the setting `IT_AWARE_SEARCH_ENABLED` is `false` (default `true`); the frontend's search bar then falls back to `GET /objects/registry/search`.

`GET /objects/registry/search` is a different route, called by the MCP and the CLI, and is unchanged.

## GET /search

Any signed-in account.

| Parameter | Type | Default | Meaning |
|---|---|---|---|
| `q` | string, at least 1 character | required | The search term; surrounding spaces are dropped |
| `lang` | `en` \| `zh` | `en` | The language of titles and labels. Matching uses both languages |
| `limit` | 1 to 100 | 20 | The most results in all |

```json
{
  "query": "incid",
  "groups": [
    {
      "kind": "task",
      "label": "Tasks",
      "results": [
        {"id": "data.incidents", "title": "Incidents", "subtitle": "Data", "opens": "/data/incidents", "score": 0.9, "pinned": false}
      ]
    },
    {
      "kind": "incident",
      "label": "Incidents",
      "results": [
        {"id": "<oid>", "title": "INC0012345", "subtitle": null, "opens": "/data/incidents/<oid>", "score": 0.6, "pinned": null}
      ]
    }
  ]
}
```

- `kind` is `task`, or a record kind of the index (`worker`, `organization`, `location`, `service_catalog`, `article`, `incident`, `request`, `analysis`, `survey`, `notification`, `scenario`).
- `opens` is the address of the result's page in the frontend. A record opens under the page of the task that shows its kind (`app/search/service.py`, `RECORD_TASKS`).
- At most 5 results per group. Groups come best first; the tasks group first on a tie.

### Security

Applied in the backend, before a result leaves it:

- a task is returned only to an account that has it;
- a record is returned only when the account holds `registry:global_registry:read`, has the task whose page shows that kind of record, and the row passes the index's data-scope filter (the same filter `GET /objects/registry/search` applies).

### Relevance

| Score | Match |
|---|---|
| 1.0 | The title equals the query |
| 0.9 | The title starts with it |
| 0.8 | A word of the title starts with it |
| 0.6 | The title contains it |
| 0.5 | Tasks only: every word of the query is found somewhere in the task's names, keywords, area or code |

`pinned` says whether the caller pinned the task to their home (`PUT /tasks/pins/{code}`, in `api_specs_tasks.md`); it is `null` for a record.

For a task, a match on a keyword counts 0.9 of the above, and on the area or the code 0.8. Records with the same score are ordered by trigram similarity, then by title. `%`, `_` and `\` in the query are literal characters.

`401` without a sign-in.
