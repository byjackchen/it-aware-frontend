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

export interface ServiceLine {
    code: string;
    name: TaskNames;
}

export interface Task {
    code: string;
    name: TaskNames;
    area: TaskNames;
    keywords: string[];
    kind: 'view' | 'do';
    origin: 'it_aware' | 'external';
    external_app: string | null;
    service_line: string;
    requires: { check: 'any' | 'all'; codes: string[] };
    opens: string;
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
    service_lines: ServiceLine[];
    tasks: Task[];
    groups: GroupTasks[];
    accounts: AccountTasks[];
}

/** The signed-in person's home (GET /tasks/home). Every list holds only tasks they have. */
export interface TaskHome {
    /** The address they land on; null lands on the home page. */
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
    service_line: string | null;
}

export interface AccountProfile extends ProfileUpdate {
    account_oid: string;
    updated_at: string | null;
    updated_by: string | null;
}
