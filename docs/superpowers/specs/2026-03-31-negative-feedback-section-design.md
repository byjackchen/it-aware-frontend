# Negative Feedback Focus Section — Design Spec

## Overview

Add a dedicated "Negative Feedback Focus" section to the Survey Analytics dashboard, positioned between AnalysisClassification and KeywordHeatmap. This section isolates negative feedback, sorted by volume, with typical issue examples — enabling prioritization and action planning.

## Data Source

Reuses existing `analysis-classification` API response. No new API endpoints needed.

- **Categories**: Extracted from `by_service_catalog[]` and `by_configuration_item[]`
- **Negative count**: Each category's `semantic.negative` value
- **Negative percentage**: `semantic.negative / count` per category
- **Typical issues**: Filtered from each category's `analyses[]` where `semantic === 'negative'`
- **Location filter**: Cross-referenced with each category's `top_locations[]` and `by_location[]`

## Layout

### Position in Dashboard

```
SurveyAnalyticsDashboard
├── SubmissionOverview
├── AnalysisClassification
├── NegativeFeedbackSection    ← NEW
└── KeywordHeatmap
```

### Section Structure

```
NegativeFeedbackSection
├── Section Header ("Negative Feedback Focus" + icon)
├── Controls Bar
│   ├── Dimension Toggle: Service Catalog | Configuration Item
│   └── Location Filter: Dropdown (All Locations + locations from by_location)
├── Content (flex row, gap-4)
│   ├── Left: NegativeBar (w-2/5, horizontal bar chart)
│   └── Right: NegativeTable (w-3/5, expandable table)
```

## Left Side — NegativeBar (Horizontal Bar Chart)

- **Chart type**: Horizontal bar chart (Recharts BarChart, layout="vertical")
- **Data**: Categories sorted by negative count descending, top 15 max
- **Bar color**: Red (`#ef4444`), single color (not stacked)
- **Y-axis**: Category name (truncated at 30 chars)
- **X-axis**: Negative count
- **Interactions**:
  - Hover bar → highlight corresponding row in right-side table
  - Click bar → open category detail page (`/data/service-catalogs/{oid}` or equivalent)

## Right Side — NegativeTable (Expandable Table)

### Columns

| Column | Content |
|--------|---------|
| Category | Category name |
| Count | Negative count + percentage badge (e.g., "45 · 62%") |
| Typical Issues | 3 inline negative analyses showing `topic` and `fact` |
| Action | "View More" expand button |

### Row Behavior

- Each row shows up to 3 negative analyses inline, each displaying:
  - `topic` (bold) + `intent` badge
  - `fact` (secondary text, truncated to 1 line)
- "View More" button expands the row to show all negative analyses for that category
  - Expanded view uses a compact list similar to DrillInPopover's list style
  - Each expanded item includes: topic, semantic badge, intent badge, fact, worker_stable_id
  - Links to open analysis detail (`/data/analyses/{oid}`) and source survey (`/data/surveys/{source_oid}`)

### Interactions

- Hover row → highlight corresponding bar in left-side chart
- Row highlight syncs with bar chart hover (bidirectional)

## Controls Bar

### Dimension Toggle

- Two options: "Service Catalog" / "Configuration Item"
- Styled as tab buttons (consistent with AnalysisClassification tab style)
- Switching dimension re-sorts and re-renders both chart and table

### Location Filter

- Dropdown select, default "All Locations"
- Options populated from `by_location[]` in the API response (location_name values)
- When a location is selected:
  - Filter categories to only those where `top_locations[]` includes the selected location
  - Recalculate displayed counts based on available data (note: exact per-location negative counts are not in the current API, so filtering shows categories that have presence in the selected location, with original negative counts)

## Component Props

```typescript
interface NegativeFeedbackSectionProps {
  batchOid: string;
  isLight: boolean;
}
```

The component calls `useSurveyAnalytics<AnalysisClassificationResponse>` with the same URL as `AnalysisClassification`. Since `useSurveyAnalytics` is SWR-based, this is served from cache — no duplicate network request.

## Styling

- Follows existing dashboard patterns: rounded-xl border, light/dark theme support via `isLight` prop
- Section header style matches AnalysisClassification header (h2, semibold)
- Section icon: `AlertTriangle` from lucide-react (red accent)
- Color palette: Red (#ef4444) as primary accent for negative emphasis

## i18n

Add keys under `SurveyAnalytics.negativeFeedback.*` in messages/en.json:
- `title`: "Negative Feedback Focus"
- `serviceCatalog`: "Service Catalog"
- `configItem`: "Configuration Item"
- `allLocations`: "All Locations"
- `count`: "Count"
- `typicalIssues`: "Typical Issues"
- `viewMore`: "View More"
- `collapse`: "Collapse"
- `noNegative`: "No negative feedback found"
- `negativeRate`: "negative rate"

## Files to Create/Modify

### New Files
- `app/(main)/campaign/survey-analytics/NegativeFeedbackSection.tsx` — main section component
- `app/(main)/campaign/survey-analytics/charts/NegativeBar.tsx` — horizontal bar chart
- `app/(main)/campaign/survey-analytics/charts/NegativeTable.tsx` — expandable table

### Modified Files
- `app/(main)/campaign/survey-analytics/SurveyAnalyticsDashboard.tsx` — add NegativeFeedbackSection between AnalysisClassification and KeywordHeatmap (passes batchOid + isLight)
- `messages/en.json` — add i18n keys
- `messages/zh.json` (if exists) — add i18n keys

## Edge Cases

- **No negative feedback**: Show empty state message ("No negative feedback found")
- **Category with 0 negatives**: Excluded from display
- **Fewer than 3 negative analyses**: Show as many as available, hide "View More" if ≤ 3
- **Long category names**: Truncate at 30 chars with ellipsis in chart, show full name in table
- **Location filter yields no results**: Show empty state

## Data Flow

```
SurveyAnalyticsDashboard
  ├── AnalysisClassification (batchOid) → useSurveyAnalytics(url) → fetches API
  ├── NegativeFeedbackSection (batchOid) → useSurveyAnalytics(url) → served from SWR cache
  │     ↓ extracts negative data from by_service_catalog / by_configuration_item
  │     ↓ filters analyses where semantic === 'negative'
  │     ↓ sorts by negative count descending
  │     ↓ renders NegativeBar + NegativeTable
  └── KeywordHeatmap (batchOid)
```
