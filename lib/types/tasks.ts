/**
 * The task catalog and "who has what tasks" (backend GET /tasks/mine and
 * GET /tasks/access; contract: specs/backend/api_specs_tasks.md).
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
