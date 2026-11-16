/**
 * The search bar's results (backend GET /search; contract:
 * specs/backend/api_specs_search.md).
 */

export interface SearchResult {
    /** A task code, or a record's oid. */
    id: string;
    title: string;
    subtitle: string | null;
    /** A task: its grouping's name. Absent or null for a record. */
    caption?: string | null;
    /** The address the result opens: a task address (`/tasks/...`), or a page's address. */
    opens: string;
    /** A task: whether the person pinned it to their home. Absent or null for a record. */
    pinned?: boolean | null;
}

export interface SearchGroup {
    /** `task`, or a record kind (`worker`, `incident`, ...). */
    kind: string;
    /** Null from today's record search: the bar then uses its own label for the kind. */
    label: string | null;
    results: SearchResult[];
}

export interface SearchResponse {
    groups: SearchGroup[];
}
