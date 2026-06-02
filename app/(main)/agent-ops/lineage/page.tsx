/**
 * AgentOps consolidated Ticket Lineage — Server Component wrapper.
 *
 * Renders the date-scoped, multi-ticket lineage forest. Data is fetched on the
 * client (it depends on the interactive date filter), so this wrapper is thin;
 * access is gated by the nav permission (ui:navigation:data + tickets:read).
 */
import { ConsolidatedLineagePage } from './ConsolidatedLineagePage';

export default function LineagePage() {
    return <ConsolidatedLineagePage />;
}
