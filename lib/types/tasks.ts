/**
 * The task catalog, "who has what tasks", the home page and the admin-set user
 * profile (backend /tasks/* and /auth/config/accounts/{oid}/profile; contracts:
 * specs/backend/api_specs_tasks.md, and for the profile the backend's own
 * specs/api_specs_auth.md).
 */

export interface TaskNames {
    en: string;
    zh: string;
}

/** A grouping: it orders and titles tasks, and has no address and no part in access. */
export interface Grouping {
    code: string;
    name: TaskNames;
}

/** A permission rule: `any` (one of the codes) or `all`. */
export interface TaskRule {
    check: 'any' | 'all';
    codes: string[];
}

/** One page inside a task, shown as a tab. */
export interface TaskView {
    slug: string;
    name: TaskNames;
    keywords: string[];
    requires: TaskRule;
    /** `/tasks/<task>` for a one-view task, `/tasks/<task>/<slug>` otherwise. */
    address: string;
}

/**
 * A task as the backend answers it. In `/tasks/mine`, `/tasks/home` and search
 * it carries only the caller's views, and `address` is the first of them.
 */
export interface Task {
    code: string;
    name: TaskNames;
    grouping: string;
    kind: 'internal' | 'external';
    external_app: string | null;
    address: string;
    keywords: string[];
    views: TaskView[];
}

/** GET /tasks/catalog: the whole catalog. */
export interface TaskCatalog {
    groupings: Grouping[];
    tasks: Task[];
}

/** GET /tasks/mine: the caller's tasks, each with only the views they have. */
export interface TasksMine {
    tasks: { task: Task; scopes: string[] }[];
}

export interface GroupTasks {
    name: string;
    scope_type: string;
    tasks: string[];
}

export interface AccountTasks {
    oid: string;
    username: string;
    account_type: string;
    is_active: boolean;
    groups: string[];
    tasks: { code: string; scopes: string[] }[];
}

export interface TaskAccess {
    groupings: Grouping[];
    tasks: Task[];
    groups: GroupTasks[];
    accounts: AccountTasks[];
}

/** The signed-in person's home (GET /tasks/home). Every list holds only tasks they have. */
export interface TaskHome {
    /** The code of the task they land on; null lands on the home page. */
    start: string | null;
    /** Set for them by an admin. */
    admin_set: Task[];
    pinned: Task[];
    recent: Task[];
    other: Task[];
}

/** What an admin sets for a user: the customization part of the profile. */
export interface ProfileUpdate {
    start_task: string | null;
    home_tasks: string[];
}

export interface AccountProfile extends ProfileUpdate {
    account_oid: string;
    updated_at: string | null;
    updated_by: string | null;
}
