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
    // click on the ratings ticket button. The content_text embeds the rating
    // as "…-{rate}|{hash}" (e.g. "actionchain-rateticket-naive-INC0109583-5|687…").
    const surveyReceived =
        behaviour === 'click' && rec.request_action === 'actionchain-rateticket-naive'
    let surveyRate: number | null = null
    if (surveyReceived && typeof row.content_text === 'string') {
        const m = row.content_text.match(/-(\d+)\|/)
        if (m) {
            const n = Number(m[1])
            if (Number.isFinite(n) && n >= 1 && n <= 5) surveyRate = n
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

        ticketId: rec.ticket?.id ?? null,
        ticketReason: rec.ticket?.reason ?? null,

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
