/**
 * User Ask / Other Case classification helpers — PBIX DAX parity.
 *
 * Implements the `Behaviour` calculated column from the PBIX report
 * (shared by Jason 2026-05-06):
 *
 *   SWITCH(TRUE(),
 *     Action Chain = "Yes",                                       "Action Chain Matched"
 *     Response contains "our live agent is on their way..." OR
 *                       "正在联系我们的海外IT工程师为您提供协助",   "Triggered Tickets"
 *     Flow States contains "faq_answer" OR
 *     Response contains "Here's what I know regarding your query" OR
 *                       "Fetch Guest WiFi" OR
 *                       "Fetch Site Engineer Information",        "FAQ Matched"
 *     Flow States contains "article_answer",                      "KB Matched"
 *     Flow States contains "unmatched",                           "unmatched_anywhere"
 *     Flow States contains "interrupted",                         "Interrupted"
 *     User Action contains "chat",                                "Enter Chat Only"
 *     [Irrelevant response-text patterns],                        "Irrelevant"
 *     default,                                                    "Interaction"
 *   )
 *
 * Backing data:
 *   - `Response` → OhlaRow.responseText (the `response_text` column,
 *     already a concatenation of rendered_text across the response
 *     array).
 *   - `Flow States` has no direct backing column locally. We proxy
 *     `faq_answer` via FaqResponseTemplate, `article_answer` via
 *     ArticleResponseTemplate. `unmatched` maps to ai_code in {OOS, NA}.
 *     `interrupted` has no local proxy — that clause falls through.
 *   - `Action Chain = "Yes"` → row's response templates include any
 *     ActionChainCard / GuestWifi / TencentWifi / FunctionCallTicket
 *     response template.
 *   - `User Action` → OhlaRow.userAction (rec.request_action).
 */

import type { OhlaRow } from './types'

export type AskCategory =
    | 'faqMatched'
    | 'actionChain'
    | 'kbMatched'
    | 'other' // catch-all for Interaction / Irrelevant / Triggered / Interrupted / EnterChatOnly / unmatched

export type AskBehaviour =
    | 'faqMatched'
    | 'actionChainMatched'
    | 'triggeredTickets'
    | 'kbMatched'
    | 'unmatchedAnywhere'
    | 'interrupted'
    | 'enterChatOnly'
    | 'interaction'
    | 'irrelevant'

export type OtherCategory = 'interaction' | 'irrelevant' | 'unmatched_anywhere'

// --- Response templates per bucket ---
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

/**
 * Post-2025-11 ground-truth signal for KB Matched. Every KB-grounded
 * LLM answer embeds the source ServiceNow article URL, so the KB link
 * substring is a reliable classifier even when the response text itself
 * is free-form.
 */
function hasKbLink(response: string): boolean {
    return response.includes('kb_knowledge') || response.includes('sysparm_article')
}

// --- Irrelevant response-text patterns (from DAX) ---
const IRRELEVANT_PATTERNS = [
    'failed to',
    'agent support confirmed',
    '【FAQ 菜单/共8条】',
    'ActionChain is Cencelled',
    'ActionChain is Cancelled',
    '任务链已取消',
    'Add a Notification Schedule',
    'Could you please clarify',
    'Could you please provide more details',
    'Error at index',
    'Sorry',
    'Thank you',
    "That's encouraging",
    'There is no active ActionChain',
    'Unrecognized command',
    '为了更好的帮助您',
    '已更新语言设置',
    '提交机器人反馈',
    '提交照片工单',
    'please specify your purpose',
    '没有正在运行的任务链',
    '谢谢鼓励',
    '问卷',
]

function hasAny(haystack: string, needles: string[]): boolean {
    for (const n of needles) if (haystack.includes(n)) return true
    return false
}

/**
 * PBIX `Behaviour` calculated column, ported to TS. Evaluates each
 * row through the PBIX SWITCH clauses in order and returns the first
 * match.
 */
export function classifyAskBehaviour(row: OhlaRow): AskBehaviour {
    const response = row.responseText ?? ''
    const lowerResponse = response.toLowerCase()
    const userAction = row.userAction ?? ''

    // 1. Action Chain Matched
    if (hasTemplate(row, ACTION_CHAIN_TEMPLATES)) return 'actionChainMatched'

    // 2. Triggered Tickets — live-agent hand-off (text or a created ticket)
    if (
        lowerResponse.includes('our live agent is on their way to help you') ||
        response.includes('正在联系我们的海外IT工程师为您提供协助') ||
        row.ticketId !== null
    ) {
        return 'triggeredTickets'
    }

    // 3. FAQ Matched — structural signal: the response carries FAQ
    //    recommendations in its template_data (post-2025-11 AI answers),
    //    OR any of the legacy response-text markers from the original
    //    PBIX DAX (older template-generated responses).
    if (
        row.recommendedFaqCount > 0 ||
        hasTemplate(row, FAQ_TEMPLATES) ||
        response.includes("Here's what I know regarding your query : ") ||
        response.includes('Fetch Guest WiFi') ||
        response.includes('Fetch Site Engineer Information')
    ) {
        return 'faqMatched'
    }

    // 4. KB Matched — response embeds a ServiceNow KB link (post-2025-11
    //    LLM answers ground on KB articles via URL), or the legacy
    //    ArticleResponseTemplate.
    if (hasTemplate(row, KB_TEMPLATES) || hasKbLink(response)) {
        return 'kbMatched'
    }

    // 5. unmatched_anywhere — Flow States ~ "unmatched"
    //    (local proxy: ai_code in {OOS, NA} since we have no flow_states)
    if (row.userActionCorrected === 'OOS' || row.userActionCorrected === 'NA') {
        return 'unmatchedAnywhere'
    }

    // 6. Interrupted — Flow States ~ "interrupted"
    //    (no local proxy — falls through)

    // 7. Enter Chat Only
    if (userAction.includes('chat')) return 'enterChatOnly'

    // 8. Irrelevant
    if (!response || hasAny(response, IRRELEVANT_PATTERNS)) {
        return 'irrelevant'
    }

    // default — Interaction
    return 'interaction'
}

/**
 * Fine-grained 4-bucket classification for the User Ask Analysis KPI
 * cards (FAQ Matched# / Action Chain# / KB Matched# / Other#).
 */
export function classifyAsk(row: OhlaRow): AskCategory {
    const b = classifyAskBehaviour(row)
    if (b === 'faqMatched') return 'faqMatched'
    if (b === 'kbMatched') return 'kbMatched'
    if (b === 'actionChainMatched') return 'actionChain'
    return 'other'
}

/**
 * Other Case Analysis 3-bucket donut. Applies only to rows where
 * classifyAsk == 'other'. Matches PBIX Other# 3 slices:
 * Interaction / Irrelevant / unmatched_anywhere.
 */
export function classifyOther(row: OhlaRow): OtherCategory {
    const b = classifyAskBehaviour(row)
    if (b === 'unmatchedAnywhere') return 'unmatched_anywhere'
    if (b === 'irrelevant') return 'irrelevant'
    return 'interaction'
}

/**
 * Does this row qualify as an Agent Support (Live Agent) hand-off?
 *
 * Aligned with Overview 'Live Agent Support#' KPI: any row whose response
 * mentions "Ticket INC*** has been created" (decode.ts back-fills the
 * `ticketId` field from the response text). The PBIX measure is the same
 * count — a unique ticket per chatbot escalation event.
 *
 * Older heuristics (template names, query+ticket) are kept as a defensive
 * fallback for rows that have a ticket attached via the structured object
 * path but no creation message.
 */
export function isAgentSupport(row: OhlaRow): boolean {
    if (row.ticketId !== null) return true
    if (row.behaviour === 'query' && classifyAskBehaviour(row) === 'triggeredTickets') return true
    return hasTemplate(row, AGENT_SUPPORT_TEMPLATES)
}
