# Incident AI Classification (`ai_category`)

> Frontend reference for the LLM-driven incident escalation-reason categorization surfaced on the SSC Dashboard.

---

## What it is

`ai_category` is an LLM-classified escalation-reason label attached to each resolved/closed incident. It is populated by the backend `digest_incidents` Airflow DAG via a Knot Workflow call. A separate `review_category` column lets human reviewers override the AI's choice.

## Valid codes

`KB_GAP` | `USER_HABIT` | `AGENT_ERR` | `MANUAL_SSC` | `ONSITE` | `SECURITY` | `MONITORING` | `OUT_OF_SCOPE`

## Backend fields (consumed via the incident list / detail APIs)

| Field | Type | Source | Notes |
|---|---|---|---|
| `ai_category` | `string \| null` | `digest_incidents` DAG | The LLM's classification code. |
| `ai_category_reason` | `string \| null` | `digest_incidents` DAG | Short LLM-generated explanation of the choice. |
| `ai_category_at` | `string \| null` (ISO 8601) | `digest_incidents` DAG | UTC timestamp the classification was written. |
| `review_category` | `string \| null` | Human reviewer (write via `PATCH /incidents/{oid}/review`) | Overrides `ai_category` when set; same valid codes. |

The slim view of `GET /incidents` includes all four fields, so list pages do not need to widen the view.

## Frontend constants

Defined in `lib/types/objects.ts`:

- `INCIDENT_CATEGORIES` — readonly tuple of valid codes
- `IncidentCategory` — union type derived from the tuple
- `INCIDENT_CATEGORY_LABELS` — `Record<IncidentCategory, { en: string; zh: string }>` for UI display

Use `INCIDENT_CATEGORY_LABELS` instead of hard-coding labels at the call site so that adding a code only requires updating the constant.

## Components

- `components/ssc/IncidentsPanel.tsx` — Category filter dropdown; passes the chosen code through as the `ai_category` query param to the incident list endpoint.
- `components/ssc/IncidentRow.tsx` — Renders the category cell and the inline `review_category` editor (writes via the review endpoint).

## Filter parameter

The list endpoint accepts `?ai_category=<CODE>` and matches exactly against the LLM-assigned value (not `review_category`). If product later wants the filter to honor `review_category` overrides, that is a backend change, not a frontend one.
