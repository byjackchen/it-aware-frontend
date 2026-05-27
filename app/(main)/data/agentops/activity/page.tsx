/**
 * AgentOps Activity Events — Server Component.
 *
 * Read-only feed of dispatcher / channel / ticket-pipeline events. The list is
 * loaded client-side via the existing listActivityEvents client (which fetches
 * the /api/agentops/activity-events proxy), so this server shell just renders
 * the themed client table.
 */
import { ActivityListPage } from './ActivityListPage';

export default function ActivityPage() {
    return <ActivityListPage />;
}
