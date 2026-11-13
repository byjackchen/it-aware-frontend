/**
 * View Usages: the backend's `/usage` API (specs/backend/api_specs_usage.md).
 * Sign-ins and opened tasks, counted over a window of whole UTC days.
 */

/** The window every answer says it used. */
export interface UsageWindow {
  days: number;
  /** Its first and last UTC day (`YYYY-MM-DD`); the last is today. */
  start: string;
  end: string;
}

export interface UsageDay {
  date: string;
  active_people: number;
  task_opens: number;
  sign_ins: number;
}

export interface UsageOverview extends UsageWindow {
  /** The UTC day of the first event ever; null with no events. */
  tracking_since: string | null;
  active_people: { today: number; last_7_days: number; window: number };
  sign_ins: number;
  task_opens: number;
  /** One entry per day of the window, the oldest first, zero-filled. */
  daily: UsageDay[];
}

export interface TaskUsage {
  task: string;
  opens: number;
  people: number;
  /** The last open ever, which can be before the window; null when never. */
  last_opened_at: string | null;
  /** Every account that has the task now, inactive and integration accounts included. */
  holders: number;
}

export interface UsageByTask extends UsageWindow {
  /** Every task of the catalog, in catalog order. */
  tasks: TaskUsage[];
}

export interface UnusedAccount {
  oid: string;
  username: string;
  /** Whether the account can sign in now. */
  active: boolean;
  /** `user` or `integration`. */
  account_type: string;
  /** That account's last open of the task ever; null when never. */
  last_opened_at: string | null;
}

export interface UnusedAccess extends UsageWindow {
  task: string;
  holders: number;
  /** How many holders did not open the task in the window. */
  total: number;
  /** One page of them, by username. */
  accounts: UnusedAccount[];
}

// ── Who: the reads that name people ──────────────────────────────────────────
// `username` is null for an account deleted since: its events remain.

/** One person who opened a task in the window. */
export interface TaskPerson {
  oid: string;
  username: string | null;
  opens: number;
  /** The distinct view slugs of those opens, alphabetical; can be empty. */
  views: string[];
  last_opened_at: string;
}

/** GET /usage/tasks/{task}/people: the people who opened one task, by opens. */
export interface TaskPeople extends UsageWindow {
  task: string;
  total: number;
  people: TaskPerson[];
}

/** One person active in the window. */
export interface ActivePerson {
  oid: string;
  username: string | null;
  sign_ins: number;
  task_opens: number;
  /** The distinct tasks among their opens. */
  tasks: number;
  last_active_at: string;
}

/** GET /usage/people: everyone with any event in the window, by task opens. */
export interface UsagePeople extends UsageWindow {
  total: number;
  people: ActivePerson[];
}

/** One task a person opened in the window. */
export interface PersonTask {
  /** The code as recorded: it can be one the catalog no longer has. */
  task: string;
  opens: number;
  views: string[];
  last_opened_at: string;
}

/** GET /usage/people/{oid}: one person's sign-ins and the tasks they opened. */
export interface PersonUsage extends UsageWindow {
  oid: string;
  username: string | null;
  sign_ins: number;
  /** By opens, then by code; not paged. */
  tasks: PersonTask[];
}
