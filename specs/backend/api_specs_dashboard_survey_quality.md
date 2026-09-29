# ServiceNow CSAT and SSC timezone contract

## ServiceNow monthly quality

Both endpoints require the existing survey-batch and incident read permissions. `batch_oid` is a survey batch OID. `timezone` is an IANA timezone name, defaults to `UTC`, and returns HTTP 422 when invalid.

| Endpoint | Required query parameters | Response |
| --- | --- | --- |
| `GET /dashboards/survey-analytics/servicenow-quality` | `batch_oid`, `start_month`, `end_month` (`YYYY-MM`) | `batch_oid`, `months[]`, `averages` |
| `GET /dashboards/survey-analytics/servicenow-month-details` | `batch_oid`, `month` (`YYYY-MM`) | `month`, `ticket_count`, `assessment_count`, `tickets[]` |

The monthly range is inclusive by month. Each ticket belongs to the month containing its `source_closed_at` in `timezone`. The backend converts the local first day of the first month and the local first day after the last month to UTC bounds, then uses `[start, end)` for both endpoints. The summary groups with the same timezone, so its ticket count and the detail endpoint describe the same set of closed ServiceNow incidents under the caller's incident read scope. For example, `2026-07-01T02:00:00Z` belongs to June in `America/Los_Angeles` and July in `UTC`.

Each `months[]` entry contains `month`, `ticket_count`, `feedback_count`, `rating_count`, `rating_sum`, `poor_count`, `csat`, `poor_rate`, and `feedback_rate`. `averages` contains the simple average of non-null monthly `csat`, `poor_rate`, and `feedback_rate` values. Detail `tickets[]` contain the incident identity, title, state, `source_closed_at`, caller, assigned group, and submitted `assessments[]` with `submitted_at`, rating, questions, and answer. Stored timestamps remain absolute instants; the frontend renders them in the selected timezone.

## SSC Dashboard list and export

The SSC Dashboard sends `created_at_from/to` for interactions and `effective_at_from/to` for incidents as ISO 8601 datetimes with explicit offsets. Changing timezone preserves the wall-clock filter text and computes new offsets, so list membership and counts can change. In a repeated fall DST hour, an inclusive start uses the earlier occurrence and an inclusive end uses the later occurrence.

`GET /objects/activities/interactions/export.xlsx` and `GET /objects/activities/incidents/export.xlsx` accept an optional `timezone` IANA name (default `UTC`; invalid values return 422). Their timestamp cells are rendered in that zone. The export receives the same offset-bearing date range as the corresponding list; changing the display zone does not rewrite stored timestamps.
