# ServiceNow CSAT and SSC timezone contract

## ServiceNow monthly quality

Both endpoints require the existing survey-batch and incident read permissions. `batch_oid` is a survey batch OID. `timezone` is an IANA timezone name, defaults to `UTC`, and returns HTTP 422 when invalid. An unknown `batch_oid` returns HTTP 404.

| Endpoint | Required query parameters | Response |
| --- | --- | --- |
| `GET /dashboards/survey-analytics/servicenow-quality` | `batch_oid`, `start_month`, `end_month` (`YYYY-MM`) | `batch_oid`, `months[]`, `averages` |
| `GET /dashboards/survey-analytics/servicenow-month-details` | `batch_oid`, `month` (`YYYY-MM`); optional `page` (1-based), `rated_only`, repeated `ratings` (1–5) | `month`, `ticket_count`, `assessment_count`, `filtered_ticket_count`, `tickets[]` |

The monthly range is inclusive by month. Each ticket belongs to the month containing its `source_closed_at` in `timezone`. The backend converts the local first day of the first month and the local first day after the last month to UTC bounds, then uses `[start, end)` for both endpoints. The summary assigns each ticket to a month by comparing its close time with those same UTC month starts, so its ticket count and the detail endpoint describe the same set of closed ServiceNow incidents under the caller's incident read scope. For example, `2026-07-01T02:00:00Z` belongs to June in `America/Los_Angeles` and July in `UTC`.

Each `months[]` entry contains `month`, `ticket_count`, `feedback_count`, `rating_count`, `rating_sum`, `poor_count`, `csat`, `poor_rate`, and `feedback_rate`. `averages` contains the simple average of non-null monthly `csat`, `poor_rate`, and `feedback_rate` values. Detail `tickets[]` contain the incident identity, title, state, `source_closed_at`, caller, assigned group, and submitted `assessments[]` with `submitted_at`, rating, questions, and answer. Stored timestamps remain absolute instants; the frontend renders them in the selected timezone.

Month details return 50 tickets per page (`page` from 1 to 1,000,000), ordered by close time descending, stable ID, and OID. `ticket_count` and `assessment_count` cover the entire month under the caller's incident scope; `filtered_ticket_count` counts matching tickets across all pages. `rated_only` selects tickets with at least one valid 1–5 rating. Repeated `ratings` values select tickets with at least one assessment whose first valid rating matches; the response still includes every submitted assessment for each selected ticket. An assessment whose `answers` is not an array of objects counts as unrated. Invalid rating values and month boundaries that cannot be represented in UTC return HTTP 422.

## SSC Dashboard list and export

The SSC Dashboard sends `created_at_from/to` for interactions and `effective_at_from/to` for incidents as ISO 8601 datetimes with explicit offsets. Changing timezone preserves the wall-clock filter text and computes new offsets, so list membership and counts can change. In a repeated fall DST hour, an inclusive start uses the earlier occurrence and an inclusive end uses the later occurrence.

`GET /objects/activities/interactions/export.xlsx` and `GET /objects/activities/incidents/export.xlsx` accept an optional `timezone` IANA name (default `UTC`; invalid values return 422). Their timestamp cells are rendered in that zone. The incident export also reads its bare-date filters (`created_at_*`, `source_created_at_*`) and offset-free `effective_at_*` values as days and wall times in that zone. The export receives the same offset-bearing date range as the corresponding list; changing the display zone does not rewrite stored timestamps.
