/**
 * User Ask / Other Case classification helpers.
 *
 * PBIX classifies each `action_type='query'` row into a bucket based on
 * the response templates surfaced by the bot. This module mirrors the
 * "Total FAQ Matched / Action Chain / KB / Interactions / Irrelevant"
 * DAX measures (the sub-measures feeding FAQ Match Rate and Overall
 * Match Rate) using the local `allResponseTemplates` on each row.
 *
 * Bucket priority (first match wins):
 *   1. FaqResponseTemplate                                 → faqMatched
 *   2. ArticleResponseTemplate                             → kbMatched
 *   3. ActionChainCardTemplate, GuestWifiTemplate,
 *      TencentWifiTemplate, FunctionCallTicketTemplate     → actionChain
 *   4. AgentSupportConfirmTemplate                         → agentSupport (routed to Live Agent)
 *   5. Any other non-idle template                         → interaction
 *   6. No non-idle template (only AiIdleTemplate or empty) → irrelevant
 *
 * The User Ask Analysis donut collapses faqMatched + kbMatched into a
 * single "FAQ Matched" slice and agentSupport into "Interaction" per PBIX.
 * The 4 KPI cards split them back out.
 */

import type { OhlaRow } from './types'

export type AskCategory =
    | 'faqMatched'
    | 'actionChain'
    | 'kbMatched'
    | 'other' // catch-all for Interaction + Irrelevant + AgentSupport

export type AskBehaviour = 'faqMatched' | 'actionChainMatched' | 'interaction' | 'irrelevant'

export type OtherCategory = 'interaction' | 'irrelevant' | 'unmatched_anywhere'

const FAQ_TEMPLATES = new Set(['FaqResponseTemplate'])
const KB_TEMPLATES = new Set(['ArticleResponseTemplate'])
const ACTION_CHAIN_TEMPLATES = new Set([
    'ActionChainCardTemplate',
    'GuestWifiTemplate',
    'TencentWifiTemplate',
    'FunctionCallTicketTemplate',
])
const AGENT_SUPPORT_TEMPLATES = new Set(['AgentSupportConfirmTemplate'])

function hasTemplate(row: OhlaRow, set: Set<string>): boolean {
    for (const t of row.allResponseTemplates) {
        if (set.has(t)) return true
    }
    return false
}

function hasAnyNonIdle(row: OhlaRow): boolean {
    return row.primaryResponseTemplate !== null
}

/** Fine-grained 4-bucket classification (User Ask Analysis KPI cards). */
export function classifyAsk(row: OhlaRow): AskCategory {
    if (hasTemplate(row, FAQ_TEMPLATES)) return 'faqMatched'
    if (hasTemplate(row, KB_TEMPLATES)) return 'kbMatched'
    if (hasTemplate(row, ACTION_CHAIN_TEMPLATES)) return 'actionChain'
    return 'other'
}

/** Donut 4-bucket classification (User Ask Analysis Behaviour Distribution). */
export function classifyAskBehaviour(row: OhlaRow): AskBehaviour {
    if (hasTemplate(row, FAQ_TEMPLATES) || hasTemplate(row, KB_TEMPLATES)) return 'faqMatched'
    if (hasTemplate(row, ACTION_CHAIN_TEMPLATES)) return 'actionChainMatched'
    if (hasAnyNonIdle(row)) return 'interaction'
    return 'irrelevant'
}

/**
 * Other Case Analysis 3-bucket donut.
 *
 * Per PBIX screenshots: Interaction 57.7% / Irrelevant 37.68% / unmatched_anywhere 4.62%.
 * Heuristic (pending exact DAX from Jason):
 *   - unmatched_anywhere: ai_code in {OOS, NA} — "out of scope" / "not available"
 *   - irrelevant: no non-idle response templates
 *   - interaction: everything else in the "other" set
 *
 * Only applies to rows where classifyAsk == 'other'.
 */
export function classifyOther(row: OhlaRow): OtherCategory {
    const code = row.userActionCorrected
    if (code === 'OOS' || code === 'NA') return 'unmatched_anywhere'
    if (!hasAnyNonIdle(row)) return 'irrelevant'
    return 'interaction'
}

/** Does this query row qualify as an Agent Support (Live Agent) hand-off? */
export function isAgentSupport(row: OhlaRow): boolean {
    return row.behaviour === 'query' && hasTemplate(row, AGENT_SUPPORT_TEMPLATES)
}
