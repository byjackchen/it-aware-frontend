/**
 * Client-side aggregations that back the Overview page's 17 visuals.
 *
 * Mirrors the 8 DAX measures used in the Power BI report:
 * - Tier 0 Supported v2  → share of query rows that received a helpful
 *   response (either is_helpful = true or helpful_score >= 1)
 * - FAQ Match Rate_2     → share of query rows where shown_faqs is
 *   non-empty (user saw at least one FAQ suggestion)
 * - Overall Match Rate_2 → share of query rows where either FAQ was
 *   shown OR a ticket was created OR a KB response was rendered
 * - Average Survey Rate_2 → mean of helpful_score across rows with a
 *   score (note: helpful_score is tri-valued -1/0/+1 per DB check)
 * - Total Action Chain_2 → total click events (proxy for action chain
 *   length on the current filter)
 * - Auto_vs_Ask Ratio    → click count / query count
 * - Non-Auto Support#    → count of interactions escalated / needing
 *   human support (approximated via assignment_status non-null)
 * - DataLagDays          → days between latest row's created_at and today
 *
 * All helpers are deliberately small and pure so they can also be called
 * from downstream User Ask / Agent Support / Survey Details pages.
 */

import type { OhlaRow } from './types'
import {
    classifyAsk,
    classifyAskBehaviour,
    classifyOther,
    isAgentSupport,
    type AskCategory,
    type AskBehaviour,
    type OtherCategory,
} from './classify'

export function countBy<T extends string | number>(
    rows: OhlaRow[],
    keyFn: (r: OhlaRow) => T | null | undefined,
): Array<{ key: T; count: number }> {
    const bucket = new Map<T, number>()
    for (const r of rows) {
        const k = keyFn(r)
        if (k === null || k === undefined) continue
        bucket.set(k, (bucket.get(k) ?? 0) + 1)
    }
    return [...bucket.entries()]
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count)
}

export function topN<T extends string | number>(
    slices: Array<{ key: T; count: number }>,
    n: number,
): Array<{ name: string; value: number }> {
    return slices
        .slice(0, n)
        .map((s) => ({ name: String(s.key), value: s.count }))
}

export function groupByMonth(
    rows: OhlaRow[],
): Array<{ month: string; total: number; byBehaviour: Record<string, number> }> {
    const bucket = new Map<string, { total: number; byBehaviour: Record<string, number> }>()
    for (const r of rows) {
        const month = r.createdDate.slice(0, 7) // YYYY-MM
        const entry = bucket.get(month) ?? { total: 0, byBehaviour: {} }
        entry.total += 1
        entry.byBehaviour[r.behaviour] = (entry.byBehaviour[r.behaviour] ?? 0) + 1
        bucket.set(month, entry)
    }
    return [...bucket.entries()]
        .map(([month, v]) => ({ month, ...v }))
        .sort((a, b) => a.month.localeCompare(b.month))
}

export interface OhlaKpis {
    // Volume
    totalInteractions: number
    distinctUsers: number
    queryCount: number
    clickCount: number
    enterChatCount: number
    vipActiveCount: number

    // Quality / coverage
    faqMatchRate: number       // 0..1, of queries with shown_faqs
    overallMatchRate: number   // 0..1, broader match (faq OR ticket OR non-empty response)
    tier0Supported: number     // PBIX 'Tier 0 Supported v2' =
                               //   [Total KB & FAQ Matched (v3)] + [Total Action Chain_2]
                               // i.e. COUNT of queries classified as
                               // faqMatched (KB+FAQ) or actionChainMatched.
    avgSurveyRate: number | null // mean helpful_score (−1..+1), null if no scores
    userSurvey: number           // PBIX 'User Survey#' = count of rows with survey received
    liveAgentSupport: number     // PBIX 'Live Agent Support#' = queries that opened a ticket

    // Flow
    autoVsAskRatio: number | null  // click / query (null if query = 0)
    totalActionChain: number       // total click count
    nonAutoSupport: number         // queries still needing human (approximation)

    // Freshness
    dataLagDays: number | null     // days between max(createdAt) and today
    latestAt: string | null        // ISO of most recent row
}

export function computeKpis(rows: OhlaRow[], now: Date = new Date()): OhlaKpis {
    if (rows.length === 0) {
        return {
            totalInteractions: 0,
            distinctUsers: 0,
            queryCount: 0,
            clickCount: 0,
            enterChatCount: 0,
            vipActiveCount: 0,
            faqMatchRate: 0,
            overallMatchRate: 0,
            tier0Supported: 0,
            avgSurveyRate: null,
            userSurvey: 0,
            liveAgentSupport: 0,
            autoVsAskRatio: null,
            totalActionChain: 0,
            nonAutoSupport: 0,
            dataLagDays: null,
            latestAt: null,
        }
    }

    const users = new Set<string>()
    let queryCount = 0
    let clickCount = 0
    let enterChatCount = 0
    let vipActive = 0
    let faqMatch = 0
    let overallMatch = 0
    let tier0 = 0
    let helpfulSum = 0
    let helpfulN = 0
    let userSurvey = 0
    let liveAgentSupport = 0
    let nonAuto = 0
    let latestMs = 0

    for (const r of rows) {
        users.add(r.actorStableId)
        if (r.isVip) vipActive += 1
        if (r.surveyReceived) userSurvey += 1

        if (r.behaviour === 'query') {
            queryCount += 1
            // Behaviour bucket drives Tier 0 *and* Match Rate accumulators
            // (PBIX DAX). Doing it once keeps Overview KPIs in lock-step
            // with the User Ask Analysis page.
            const b = classifyAskBehaviour(r)
            if (b === 'faqMatched') faqMatch += 1
            if (b === 'faqMatched' || b === 'kbMatched' || b === 'actionChainMatched') {
                tier0 += 1
            }
            // PBIX Overall Match Rate denominator excludes Irrelevant.
            if (b !== 'irrelevant') overallMatch += 1
            if (r.ticketId !== null) liveAgentSupport += 1
            if (!r.isHelpful && !r.ticketId && r.shownFaqCount === 0 && r.recommendedFaqCount === 0) {
                nonAuto += 1
            }
        } else if (r.behaviour === 'click') {
            clickCount += 1
        } else if (r.behaviour === 'enter_chat') {
            enterChatCount += 1
        }

        if (typeof r.helpfulScore === 'number') {
            helpfulSum += r.helpfulScore
            helpfulN += 1
        }

        const ms = Date.parse(r.createdAt)
        if (!Number.isNaN(ms) && ms > latestMs) latestMs = ms
    }

    // PBIX DAX:
    //   FAQ Match Rate_2     = FAQ / (FAQ + Irrelevant)
    //   Overall Match Rate_2 = (Total - Irrelevant) / Total
    // queryCount = total queries; (queryCount - overallMatch) = irrelevant.
    const irrelevantCount = queryCount - overallMatch
    const faqDenom = faqMatch + irrelevantCount
    const faqMatchRate = faqDenom > 0 ? faqMatch / faqDenom : 0
    const overallMatchRate = queryCount > 0 ? overallMatch / queryCount : 0
    const tier0Supported = tier0 // PBIX-parity: report the raw count, not a ratio
    const avgSurveyRate = helpfulN > 0 ? helpfulSum / helpfulN : null
    const autoVsAskRatio = queryCount > 0 ? clickCount / queryCount : null

    const latestAt = latestMs > 0 ? new Date(latestMs).toISOString() : null
    const dataLagDays = latestMs > 0
        ? Math.floor((now.getTime() - latestMs) / (24 * 60 * 60 * 1000))
        : null

    return {
        totalInteractions: rows.length,
        distinctUsers: users.size,
        queryCount,
        clickCount,
        enterChatCount,
        vipActiveCount: vipActive,
        faqMatchRate,
        overallMatchRate,
        tier0Supported,
        avgSurveyRate,
        userSurvey,
        liveAgentSupport,
        autoVsAskRatio,
        totalActionChain: clickCount,
        nonAutoSupport: nonAuto,
        dataLagDays,
        latestAt,
    }
}

/** Filter rows to a [from, to] date-only window, inclusive both ends. */
export function filterByDateRange(
    rows: OhlaRow[],
    from: string | null,
    to: string | null,
): OhlaRow[] {
    if (!from && !to) return rows
    return rows.filter((r) => {
        if (from && r.createdDate < from) return false
        if (to && r.createdDate > to) return false
        return true
    })
}

// ============================================================================
// User Ask Analysis
// ============================================================================

export interface AskKpis {
    /** Total queries (User Ask#). */
    userAsk: number
    /** 4-card buckets (mutually exclusive, sum == userAsk). */
    faqMatched: number
    kbMatched: number
    actionChain: number
    other: number
    /** Donut 4 buckets (mutually exclusive, sum == userAsk). */
    faqMatchedBehaviour: number
    actionChainMatched: number
    interaction: number
    irrelevant: number
    /** DAX-parity rates. */
    faqMatchRate: number // FAQ Matched / (Queries - Action Chain - KB - Interactions)
    overallMatchRate: number // (KB + FAQ + AC + Interactions) / Queries
}

export function computeAskKpis(allRows: OhlaRow[]): AskKpis {
    const queries = allRows.filter((r) => r.behaviour === 'query')
    let faqMatched = 0
    let kbMatched = 0
    let actionChain = 0
    let other = 0
    let interaction = 0
    let irrelevant = 0
    let actionChainMatchedB = 0
    let faqMatchedB = 0
    for (const q of queries) {
        const c = classifyAsk(q)
        if (c === 'faqMatched') faqMatched += 1
        else if (c === 'kbMatched') kbMatched += 1
        else if (c === 'actionChain') actionChain += 1
        else other += 1

        const b = classifyAskBehaviour(q)
        if (b === 'faqMatched') faqMatchedB += 1
        else if (b === 'actionChainMatched') actionChainMatchedB += 1
        else if (b === 'interaction') interaction += 1
        else irrelevant += 1
    }
    const userAsk = queries.length

    // DAX Overall Match Rate = (KB + FAQ + Action Chain + Interactions) / Queries
    // = 1 - irrelevant / userAsk (since buckets are exclusive and sum to userAsk).
    const overallMatchRate =
        userAsk > 0 ? (faqMatched + kbMatched + actionChain + interaction) / userAsk : 0
    // DAX FAQ Match Rate = FAQ / (Queries - Action Chain - KB - Interactions)
    //                    = FAQ / (FAQ + Irrelevant)   [algebraic rewrite]
    const faqDenom = userAsk - actionChain - kbMatched - interaction
    const faqMatchRate = faqDenom > 0 ? faqMatched / faqDenom : 0

    return {
        userAsk,
        faqMatched,
        kbMatched,
        actionChain,
        other,
        faqMatchedBehaviour: faqMatchedB,
        actionChainMatched: actionChainMatchedB,
        interaction,
        irrelevant,
        faqMatchRate,
        overallMatchRate,
    }
}

/** Per-day rollup for the User Ask bottom combo chart. */
export interface AskDayBucket {
    day: string // YYYY-MM-DD
    faqMatched: number
    actionChainMatched: number
    interaction: number
    irrelevant: number
    faqMatchRate: number // per-day, same DAX logic as global
    overallMatchRate: number
}

export function groupAskByDay(allRows: OhlaRow[]): AskDayBucket[] {
    const map = new Map<string, AskDayBucket>()
    for (const r of allRows) {
        if (r.behaviour !== 'query') continue
        const day = r.createdDate
        const b = classifyAskBehaviour(r)
        let entry = map.get(day)
        if (!entry) {
            entry = {
                day,
                faqMatched: 0,
                actionChainMatched: 0,
                interaction: 0,
                irrelevant: 0,
                faqMatchRate: 0,
                overallMatchRate: 0,
            }
            map.set(day, entry)
        }
        if (b === 'faqMatched') entry.faqMatched += 1
        else if (b === 'actionChainMatched') entry.actionChainMatched += 1
        else if (b === 'interaction') entry.interaction += 1
        else entry.irrelevant += 1
    }
    const arr = [...map.values()].sort((a, b) => a.day.localeCompare(b.day))
    for (const e of arr) {
        const total = e.faqMatched + e.actionChainMatched + e.interaction + e.irrelevant
        e.overallMatchRate = total > 0 ? (total - e.irrelevant) / total : 0
        const denom = total - e.actionChainMatched - e.interaction // = faqMatched + irrelevant
        e.faqMatchRate = denom > 0 ? e.faqMatched / denom : 0
    }
    return arr
}

// ============================================================================
// Other Case Analysis
// ============================================================================

/**
 * Per-month rollup for the Overview "Auto Support vs Total Ask" combo chart.
 * Stacked bars: Live Agent Support (top) + Ohla Auto Support (bottom).
 * Line: auto support rate = autoSupport / (autoSupport + liveAgent).
 */
export interface AutoVsAskMonthBucket {
    month: string // YYYY-MM
    monthLabel: string // e.g. "January"
    autoSupport: number // = tier0 (faqMatched + kbMatched + actionChainMatched) within queries
    liveAgentSupport: number // queries with ticketId
    autoRate: number // 0..1
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
]

export function groupAutoVsAskByMonth(allRows: OhlaRow[]): AutoVsAskMonthBucket[] {
    const map = new Map<string, { auto: number; live: number }>()
    for (const r of allRows) {
        if (r.behaviour !== 'query') continue
        const month = r.createdDate.slice(0, 7) // YYYY-MM
        let entry = map.get(month)
        if (!entry) {
            entry = { auto: 0, live: 0 }
            map.set(month, entry)
        }
        const b = classifyAskBehaviour(r)
        if (b === 'faqMatched' || b === 'kbMatched' || b === 'actionChainMatched') {
            entry.auto += 1
        }
        if (r.ticketId !== null) {
            entry.live += 1
        }
    }
    return [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, v]) => {
            const idx = parseInt(month.slice(5, 7), 10) - 1
            const total = v.auto + v.live
            return {
                month,
                monthLabel: MONTH_NAMES[idx] ?? month,
                autoSupport: v.auto,
                liveAgentSupport: v.live,
                autoRate: total > 0 ? v.auto / total : 0,
            }
        })
}

export interface OtherKpis {
    /** rows classified into 'other' bucket from classifyAsk. */
    other: number
    interaction: number
    irrelevant: number
    unmatchedAnywhere: number
}

export function computeOtherKpis(allRows: OhlaRow[]): OtherKpis {
    let interaction = 0
    let irrelevant = 0
    let unmatchedAnywhere = 0
    for (const r of allRows) {
        if (r.behaviour !== 'query') continue
        if (classifyAsk(r) !== 'other') continue
        const c = classifyOther(r)
        if (c === 'interaction') interaction += 1
        else if (c === 'irrelevant') irrelevant += 1
        else unmatchedAnywhere += 1
    }
    return {
        other: interaction + irrelevant + unmatchedAnywhere,
        interaction,
        irrelevant,
        unmatchedAnywhere,
    }
}

export interface OtherDayBucket {
    day: string
    interaction: number
    irrelevant: number
    unmatched_anywhere: number
}

export function groupOtherByDay(allRows: OhlaRow[]): OtherDayBucket[] {
    const map = new Map<string, OtherDayBucket>()
    for (const r of allRows) {
        if (r.behaviour !== 'query') continue
        if (classifyAsk(r) !== 'other') continue
        const day = r.createdDate
        let entry = map.get(day)
        if (!entry) {
            entry = { day, interaction: 0, irrelevant: 0, unmatched_anywhere: 0 }
            map.set(day, entry)
        }
        const c = classifyOther(r)
        if (c === 'interaction') entry.interaction += 1
        else if (c === 'irrelevant') entry.irrelevant += 1
        else entry.unmatched_anywhere += 1
    }
    return [...map.values()].sort((a, b) => a.day.localeCompare(b.day))
}

// ============================================================================
// Agent Support
// ============================================================================

export interface AgentSupportKpis {
    count: number
}

export function computeAgentSupportKpis(allRows: OhlaRow[]): AgentSupportKpis {
    let n = 0
    for (const r of allRows) if (isAgentSupport(r)) n += 1
    return { count: n }
}

export function groupAgentSupportByDay(allRows: OhlaRow[]): Array<{ day: string; count: number }> {
    const map = new Map<string, number>()
    for (const r of allRows) {
        if (!isAgentSupport(r)) continue
        map.set(r.createdDate, (map.get(r.createdDate) ?? 0) + 1)
    }
    return [...map.entries()]
        .map(([day, count]) => ({ day, count }))
        .sort((a, b) => a.day.localeCompare(b.day))
}

// ============================================================================
// Survey Details
// ============================================================================

export interface SurveyKpis {
    surveyCount: number
    avgRate: number | null // null if no rows
}

export function computeSurveyKpis(allRows: OhlaRow[]): SurveyKpis {
    let sum = 0
    let n = 0
    for (const r of allRows) {
        if (!r.surveyReceived) continue
        if (typeof r.surveyRate !== 'number') continue
        sum += r.surveyRate
        n += 1
    }
    return { surveyCount: n, avgRate: n > 0 ? sum / n : null }
}

// Export re-used classify types so pages only need one import.
export type { AskCategory, AskBehaviour, OtherCategory }

