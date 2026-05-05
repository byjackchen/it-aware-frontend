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
    tier0Supported: number     // 0..1, queries with is_helpful true OR helpful_score >= 1
    avgSurveyRate: number | null // mean helpful_score (−1..+1), null if no scores

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
    let nonAuto = 0
    let latestMs = 0

    for (const r of rows) {
        users.add(r.actorStableId)
        if (r.isVip) vipActive += 1

        if (r.behaviour === 'query') {
            queryCount += 1
            if (r.shownFaqCount > 0 || r.recommendedFaqCount > 0) faqMatch += 1
            const hasKbResponse = !!r.responseText && r.responseText.length > 20
            if (r.shownFaqCount > 0 || r.recommendedFaqCount > 0 || r.ticketId || hasKbResponse) {
                overallMatch += 1
            }
            if (r.isHelpful === true || (typeof r.helpfulScore === 'number' && r.helpfulScore >= 1)) {
                tier0 += 1
            }
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

    const faqMatchRate = queryCount > 0 ? faqMatch / queryCount : 0
    const overallMatchRate = queryCount > 0 ? overallMatch / queryCount : 0
    const tier0Supported = queryCount > 0 ? tier0 / queryCount : 0
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
