# Ohla Journey dashboard API consumed by the frontend

The backend contract is `it-aware-backend/specs/api_specs_dashboard_ohla_journey.md` (version 4.0). This frontend reads only imported, versioned report data. It does not receive Ohla Journey's standard inputs, open local `runs/` files, or upload reports from the browser.

The client helper in `lib/api/ohla_journey.ts` calls `/api/dashboards/ohla-journey/...`. The matching Next route at `app/api/dashboards/ohla-journey/[...path]/route.ts` forwards GET requests to the same path under the backend `/dashboards/ohla-journey/...`, with the current `it_aware_access` cookie. It does not proxy POST imports. Responses are private and uncached.

| Backend GET path under `/dashboards/ohla-journey` | Frontend use |
|---|---|
| `/reports` | Version selector; one selected `round_id` is stored in browser session storage. |
| `/reports/{round_id}` | Version metadata. |
| `/reports/{round_id}/sections/{section}` | The eight report pages; chart values, filter options, window and bilingual catalog come from this response. |
| `/reports/{round_id}/entities/{kind}` | Paged and filtered user, journey, request, unit, gap and persona lists. |
| `/reports/{round_id}/entities/{kind}/{entity_id}` | Full detail drawer. |

`round_id=current` means the backend's active version, though the UI normally sends the explicit selected round. Section names are `headline`, `resolution`, `gaps`, `journey`, `timeline`, `persona`, `patterns`, `audit`. The browser uses the same filter codes for charts and detail lists; translation affects labels only. A persona card selects that persona and filters the relevant lists. Resolution and Timeline omit channel/region controls by the agreed report policy. A missing version/section/entity returns 404; unsupported filters return 422. Import authorization and seven-file upload details are backend concerns, documented in the backend spec.

The TopBar entry and all eight sidebar links appear for either `dashboards:ohla_journey:read` or `ui:navigation:operation`, matching the backend read rule. The timeline covers the selected report's actual window, including when a filter removes the published full-window timeline object. Entity list and drawer requests show an error with retry on failure; a failed request is not displayed as an empty result. Gap topic bars account for every item in their totals, including an `Other` segment for historical data outside the two current gap families.
