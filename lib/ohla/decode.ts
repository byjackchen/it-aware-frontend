/**
 * Decode raw activities.interactions rows into the flat OhlaRow shape
 * the dashboard visuals consume.
 *
 * Business Group derivation: workers.department_name in IT-Aware is the
 * leaf department. The Power BI report uses the top-level group (CSIG /
 * IEG / S3 / WXG / ...) which is the first token before " - " or "/"
 * in the org_name from hierarchies.organizations. Since the worker
 * list endpoint currently only exposes department_name, we fall back
 * to taking the first slash-separated segment of department_name when
 * it already encodes the full org path; otherwise we use it as-is.
 */

import type { Interaction, Worker } from '@/lib/types/objects'
import type {
    Behaviour,
    OhlaRecord,
    OhlaRow,
    OhlaResponseEntry,
    WorkersByStableId,
} from './types'

function asRecord(raw: Interaction['content_raw']): OhlaRecord {
    if (!raw || typeof raw !== 'object') return {}
    const r = (raw as { record?: unknown }).record
    if (!r || typeof r !== 'object') return {}
    return r as OhlaRecord
}

function extractResponses(raw: Interaction['response_raw']): OhlaResponseEntry[] {
    if (!raw || typeof raw !== 'object') return []
    const r = (raw as { responses?: unknown }).responses
    return Array.isArray(r) ? (r as OhlaResponseEntry[]) : []
}

function isBehaviour(v: string): v is Behaviour {
    return v === 'enter_chat' || v === 'click' || v === 'query'
}

function toDateOnly(iso: string): string {
    return iso.slice(0, 10)
}

/**
 * Extract a ticket id (e.g. "INC0119747") from the bot response text.
 * The ticket-creation response always reads:
 *   "✨ Ticket INC0119747 has been created. We are now pulling you into a..."
 * This is the only reliable signal for "Live Agent Support#" because the
 * dump's `record.ticket` JSON object is null for nearly every row.
 */
function extractTicketIdFromResponse(text: string | null | undefined): string | null {
    if (typeof text !== 'string') return null
    const m = text.match(/Ticket\s+(INC\d+)\s+has been created/i)
    return m ? m[1] : null
}

/**
 * PBIX 'Live Agent Support#' counts user clicks on the "Contact Live Agent"
 * button — i.e. action_type='click' with EventKey starting with "agentsupport"
 * (covers both the initial entry "agentsupport" and the confirm step
 * "agentsupport-confirm"). PBIX uses the entry click only — pattern matched
 * by EventKey base part = 'agentsupport' (no suffix).
 */
function detectAgentSupportClick(behaviour: Behaviour, rec: OhlaRecord): boolean {
    if (behaviour !== 'click') return false
    const msg = rec.request_msg as
        | { Msg?: { EventKey?: unknown } }
        | undefined
    const ek = msg?.Msg?.EventKey
    if (typeof ek !== 'string') return false
    const base = ek.split('|')[0]
    return base === 'agentsupport'
}

function deriveBusinessGroup(worker: Worker | undefined): string | null {
    if (!worker) return null
    const raw = worker.department_name ?? null
    if (!raw) return null
    // "CSIG - Cloud..." or "IEG/TiMi Studios/..." — both yield CSIG / IEG.
    const firstSep = raw.search(/[ /]-| - |\//)
    if (firstSep > 0) return raw.slice(0, firstSep).trim()
    return raw.trim() || null
}

export function buildWorkersLookup(workers: Worker[]): WorkersByStableId {
    const m = new Map<string, Worker>()
    for (const w of workers) {
        if (w.stable_id) m.set(w.stable_id, w)
    }
    return m
}

export function decodeInteraction(
    row: Interaction,
    workers: WorkersByStableId,
): OhlaRow {
    const rec = asRecord(row.content_raw)
    const responses = extractResponses(row.response_raw)
    const behaviour: Behaviour = isBehaviour(row.action_type) ? row.action_type : 'query'
    const worker = row.actor_stable_id ? workers.get(row.actor_stable_id) : undefined

    // Count total recommendations surfaced across all response entries.
    let recommendedFaqCount = 0
    const allResponseTemplates: string[] = []
    for (const r of responses) {
        const recs = r.template_data?.recommendations
        if (Array.isArray(recs)) recommendedFaqCount += recs.length
        if (r.template_name) allResponseTemplates.push(r.template_name)
    }
    const primaryResponseTemplate =
        allResponseTemplates.find((t) => t !== 'AiIdleTemplate') ?? null

    const shownFaqs = Array.isArray(rec.shown_faqs) ? rec.shown_faqs : null

    // Survey detection — PBIX 'Survey Received? = "Yes"':
    // click on the ratings ticket button. content_text embeds the rating as
    // "[Click: actionchain-{rateticket|ticket_rating}-naive-INC0123456-5|hash]".
    // Old data used "rateticket-naive"; from 2025-11 onwards it's "ticket_rating-naive".
    // Detect via content_text shape so we catch both variants.
    const reqAction = rec.request_action
    const isRateClick =
        behaviour === 'click' &&
        (typeof reqAction === 'string'
            ? /(?:rateticket|ticket_rating)-naive/.test(reqAction)
            : false ||
              (typeof row.content_text === 'string' &&
                  /(?:rateticket|ticket_rating)-naive-[A-Z0-9]+-(\d+)\|/.test(row.content_text)))
    let surveyRate: number | null = null
    let surveyReceived = isRateClick
    if (typeof row.content_text === 'string') {
        const m = row.content_text.match(/(?:rateticket|ticket_rating)-naive-[A-Z0-9]+-(\d+)\|/)
        if (m) {
            const n = Number(m[1])
            if (Number.isFinite(n) && n >= 1 && n <= 5) {
                surveyRate = n
                surveyReceived = true
            }
        }
    }

    return {
        oid: row.oid,
        stable_id: row.stable_id,
        createdAt: row.created_at,
        createdDate: toDateOnly(row.created_at),
        actorStableId: row.actor_stable_id,

        behaviour,
        userAction: rec.request_action ?? null,
        userActionCorrected: row.ai_code ?? null,

        userContent: row.content_text ?? rec.request_content ?? null,
        responseText: row.response_text ?? null,
        deviceType: rec.device_type ?? null,

        cycleId: rec.cycle_id ?? null,
        sessionId: rec.request_session_id ?? null,

        isHelpful: rec.is_helpful ?? null,
        helpfulScore: row.helpful_score ?? null,

        shownFaqCount: shownFaqs ? shownFaqs.length : 0,
        recommendedFaqCount,

        ticketId: rec.ticket?.id ?? extractTicketIdFromResponse(row.response_text) ?? null,
        ticketReason: rec.ticket?.reason ?? null,
        clickedAgentSupport: detectAgentSupportClick(behaviour, rec),

        allResponseTemplates,
        primaryResponseTemplate,

        surveyReceived,
        surveyRate,

        region: worker?.region_name ?? null,
        country: worker?.country_name ?? null,
        businessGroup: deriveBusinessGroup(worker),
        isVip: worker?.is_vip ?? null,
    }
}

/** One FAQ the bot grounded its answer on. */
export interface ReferencedFaq {
    hash: string
    title: string | null
}

/**
 * FAQ entries Ohla actually *cited* when answering — the
 * `template_data.recommendations` carried by each response entry
 * (the post-2025-11 structured signal; see classifyAskBehaviour case 3).
 * Deduplicated by faq_hash, source order preserved.
 *
 * Deliberately NOT `record.shown_faqs`: that is the FAQ menu pushed at the
 * user, which the answer may never have used.
 */
export function extractReferencedFaqs(row: Interaction): ReferencedFaq[] {
    const out: ReferencedFaq[] = []
    const seen = new Set<string>()
    for (const r of extractResponses(row.response_raw)) {
        const recs = r.template_data?.recommendations
        if (!Array.isArray(recs)) continue
        for (const rec of recs) {
            const hash = typeof rec?.faq_hash === 'string' ? rec.faq_hash.trim() : ''
            if (!hash || seen.has(hash)) continue
            seen.add(hash)
            out.push({
                hash,
                title: typeof rec?.faq_title === 'string' ? rec.faq_title : null,
            })
        }
    }
    return out
}

/** A ServiceNow KB article Ohla cited. */
export interface ReferencedArticle {
    /** KB number parsed out of the citation url, e.g. "KB0013830". */
    kb: string | null
    title: string
}

// KB numbers reach us embedded in the citation url as
// `...&sysparm_article=KB0013830`. Case-sensitive on purpose: the same url
// also contains the lowercase literal `id=kb_article`, so a case-insensitive
// match would be a coin flip on which one it hits first.
const KB_NUMBER_RE = /KB\d+/

/**
 * ServiceNow KB articles Ohla cited when answering — the `type: 'article'`
 * siblings of the faq entries `extractReferencedFaqs` reads, from the same
 * `template_data.recommendations` array.
 *
 * Note the shape inverts against `ReferencedFaq`: every article carries a
 * title but a handful carry no resolvable KB number, where a faq always has
 * a hash and may have no title.
 *
 * Deduplicated by KB number (falling back to title for the url-less few),
 * source order preserved.
 */
export function extractReferencedArticles(row: Interaction): ReferencedArticle[] {
    const out: ReferencedArticle[] = []
    const seen = new Set<string>()
    for (const r of extractResponses(row.response_raw)) {
        const recs = r.template_data?.recommendations
        if (!Array.isArray(recs)) continue
        for (const rec of recs) {
            // The `type` gate is the whole filter — matching on "has a title"
            // would sweep in the tool entries, and on "has a url" the
            // retrieval chunks.
            if (rec?.type !== 'article') continue
            const title = typeof rec.title === 'string' ? rec.title.trim() : ''
            if (!title) continue
            const kb = (typeof rec.url === 'string' ? rec.url.match(KB_NUMBER_RE)?.[0] : null) ?? null
            // Fall back to the title so two different url-less articles both
            // survive rather than collapsing into one.
            const key = kb ?? `title:${title}`
            if (seen.has(key)) continue
            seen.add(key)
            out.push({ kb, title })
        }
    }
    return out
}
