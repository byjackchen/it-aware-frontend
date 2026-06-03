/**
 * Helpers shared by the activity list rows (requests + incidents).
 *
 * - getStateDotColor() maps a state string to Tailwind color classes
 *   for the leading colored dot.
 * - resolveCaller() picks the best human-readable caller label given
 *   the typed-actor + caller_name fields surfaced by the list response.
 */

export type ActivityRowItem = {
  actor?: {
    fullname?: string | null;
    organization?: { descriptor?: string | null } | null;
  } | null;
  caller_name?: string | null;
  actor_stable_id?: string | null;
};

const STATE_BLUE = new Set([
  'new',
  'open',
  'work in progress',
  'work_in_progress',
  'assigned',
  'in progress',
  'in_progress',
]);

const STATE_YELLOW = new Set([
  'pending',
  'on hold',
  'on_hold',
  'awaiting',
  'awaiting_user_info',
  'awaiting_problem',
  'awaiting_caller',
  'awaiting_evidence',
]);

const STATE_GREEN = new Set([
  'resolved',
  'closed complete',
  'closed_complete',
  'complete',
  'done',
]);

const STATE_GRAY = new Set([
  'closed incomplete',
  'closed_incomplete',
  'canceled',
  'cancelled',
  'rejected',
]);

export function getStateDotColor(state: string | null | undefined): string {
  const norm = (state ?? '').trim().toLowerCase();
  if (!norm) return 'bg-gray-400';
  if (STATE_BLUE.has(norm)) return 'bg-blue-500';
  if (STATE_YELLOW.has(norm)) return 'bg-yellow-500';
  if (STATE_GREEN.has(norm)) return 'bg-green-500';
  if (STATE_GRAY.has(norm)) return 'bg-gray-400';
  return 'bg-gray-400';
}

/**
 * Caller fallback chain:
 *   actor.fullname > caller_name > actor_stable_id > '—'
 */
export function resolveCaller(item: ActivityRowItem): string {
  return (
    item.actor?.fullname ||
    item.caller_name ||
    item.actor_stable_id ||
    '—'
  );
}

/** Org descriptor for the caller, when the actor is a worker. */
export function resolveCallerOrg(item: ActivityRowItem): string | null {
  return item.actor?.organization?.descriptor ?? null;
}
