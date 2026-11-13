/**
 * View Usages: the backend's `/usage` API (it-aware-backend specs/api_specs_usage.md).
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
  /** The active user accounts that have the task now. */
  holders: number;
}

export interface UsageByTask extends UsageWindow {
  /** Every task of the catalog, in catalog order. */
  tasks: TaskUsage[];
}

export interface UnusedAccount {
  oid: string;
  username: string;
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
