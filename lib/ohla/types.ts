/**
 * Ohla Chatbot dashboard — typed wrappers around the raw Interaction row.
 *
 * activities.interactions (source_system='chatbot') is the canonical backing
 * store for the Power BI "Ohla_Chat_History_Zach_2" table. Most fields live
 * under content_raw.record — these helpers decode that safely and never
 * throw on malformed rows.
 */

import type { Interaction, Worker } from '@/lib/types/objects';

export type Behaviour = 'enter_chat' | 'click' | 'query';

/** The subset of content_raw.record fields the Ohla dashboard cares about. */
export interface OhlaRecord {
    request_groupchat_id?: string | null;
    request_session_id?: string | null;
    cycle_id?: string | null;
    request_content?: string | null;
    request_action?: string | null;
    requester_id?: string | null;
    requester_type?: string | null;
    device_type?: string | null;
    is_helpful?: boolean | null;
    shown_faqs?: Array<{ faq_hash?: string; faq_title?: string }> | null;
    responses?: OhlaResponseEntry[] | null;
    clicks?: unknown;
    ticket?: { id?: string; reason?: string } | null;
    request_msg?: Record<string, unknown> | null;
    request_time?: string | null;
}

export interface OhlaResponseEntry {
    sent_to?: string;
    timestamp?: string;
    message_type?: string;
    template_name?: string;
    template_data?: {
        lang?: string;
        text?: string;
        recommendations?: Array<{ type?: string; faq_hash?: string; faq_title?: string }>;
    } | null;
    rendered_text?: string | null;
}

/** Flattened, UI-ready shape the dashboard visuals actually work with. */
export interface OhlaRow {
    // Passthrough identifiers
    oid: string;
    stable_id: string;
    createdAt: string;                 // ISO date-time
    createdDate: string;               // YYYY-MM-DD (Date Only)
    actorStableId: string;             // Masked WeCom ID

    // Behaviour axis
    behaviour: Behaviour;
    userAction: string | null;         // record.request_action (raw)
    userActionCorrected: string | null; // ai_code (normalized enum)

    // Content
    userContent: string | null;
    responseText: string | null;
    deviceType: string | null;

    // Session-ish
    cycleId: string | null;
    sessionId: string | null;

    // Helpfulness / survey
    isHelpful: boolean | null;
    helpfulScore: number | null;

    // FAQ recommendations
    shownFaqCount: number;
    recommendedFaqCount: number;

    // Ticket (prod-only; null locally)
    ticketId: string | null;
    ticketReason: string | null;

    // Response template decoding (for User Ask / Other Case classification)
    allResponseTemplates: string[];        // in order, including AiIdleTemplate
    primaryResponseTemplate: string | null; // first non-AiIdleTemplate, null if all idle or empty

    // Survey (rate-ticket click events)
    // surveyReceived ≈ PBIX 'Survey Received? = "Yes"':
    //   action_type='click' AND request_action='actionchain-rateticket-naive'
    // surveyRate: parsed from content_text, value in 1-5
    surveyReceived: boolean;
    surveyRate: number | null;

    // Enriched via workers lookup
    region: string | null;
    country: string | null;
    businessGroup: string | null;
    isVip: boolean | null;
}

/** Convenience alias for a lookup map keyed by worker stable_id. */
export type WorkersByStableId = Map<string, Worker>;

/** Input to the worker enrichment step. */
export type InteractionRow = Interaction;
