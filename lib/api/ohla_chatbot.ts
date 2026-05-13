/**
 * Typed wrappers for the 5 Ohla Chatbot dashboard report endpoints.
 *
 * All endpoints share:
 * - Path prefix /api/objects/activities/interactions/report/ohla-chatbot-<view>
 * - Query: date_from + date_to (YYYY-MM-DD UTC)
 * - Permission: INTERACTIONS_READ (same as the existing /interactions list)
 * - Response: { current: Block, previous: Block } per rule #10
 *
 * The Pydantic models on the backend live in
 * app/objects/activities/interaction/schemas.py (frozen + extra='forbid').
 *
 * Calls go through the Next.js `/api/objects/<resource>` proxy route, which
 * already forwards query params to the backend while injecting the
 * `it_aware_access` cookie server-side.
 */

// ── Shared chart primitives ──────────────────────────────────────────────────

export interface LabelCount {
    label: string;
    count: number;
}

export interface DateCount {
    date: string;
    count: number;
}

export interface DateDistinct {
    date: string;
    distinct_users: number;
}

export interface MonthAutoVsTotal {
    month: string;
    auto_support: number;
    live_agent_support: number;
    auto_rate: number;
}

export interface BucketCount {
    bucket: string;
    count: number;
}

// ── Overview ────────────────────────────────────────────────────────────────

export interface OverviewKpis {
    total_interactions: number;
    user_ask_count: number;
    total_action_chain: number;
    distinct_users: number;
    tier0_supported: number;
    live_agent_support_count: number;
    user_survey_count: number;
    avg_survey_rate: number | null;
    data_lag_days: number;
}

export interface OverviewCharts {
    by_business_group: LabelCount[];
    by_action: LabelCount[];
    by_region: LabelCount[];
    page_views_daily: DateCount[];
    unique_visitors_daily: DateDistinct[];
    auto_vs_total_monthly: MonthAutoVsTotal[];
}

export interface OverviewBlock {
    kpis: OverviewKpis;
    charts: OverviewCharts;
}

export interface OhlaChatbotOverviewReport {
    current: OverviewBlock;
    previous: OverviewBlock;
}

// ── User Ask Analysis ────────────────────────────────────────────────────────

export interface UserAskKpis {
    user_ask_count: number;
    faq_match_rate: number;
    overall_match_rate: number;
    faq_matched_count: number;
    action_chain_count: number;
    kb_matched_count: number;
    other_count: number;
}

export interface UserAskDailyRow {
    date: string;
    faq_matched: number;
    action_chain_matched: number;
    interaction: number;
    irrelevant: number;
    faq_match_rate: number;
    overall_match_rate: number;
}

export interface UserAskCharts {
    behaviour_distribution: BucketCount[];
    behaviour_daily: UserAskDailyRow[];
}

export interface UserAskBlock {
    kpis: UserAskKpis;
    charts: UserAskCharts;
}

export interface OhlaChatbotUserAskReport {
    current: UserAskBlock;
    previous: UserAskBlock;
}

// ── Agent Support ───────────────────────────────────────────────────────────

export interface AgentSupportKpis {
    agent_support_count: number;
}

export interface AgentSupportCharts {
    daily_trend: DateCount[];
}

export interface AgentSupportBlock {
    kpis: AgentSupportKpis;
    charts: AgentSupportCharts;
}

export interface OhlaChatbotAgentSupportReport {
    current: AgentSupportBlock;
    previous: AgentSupportBlock;
}

// ── Survey Details ──────────────────────────────────────────────────────────

export interface SurveyKpis {
    survey_count: number;
    avg_survey_rate: number | null;
}

export interface SurveyFilterOptions {
    business_groups: string[];
    countries: string[];
}

export interface SurveyBlock {
    kpis: SurveyKpis;
    filter_options: SurveyFilterOptions;
}

export interface OhlaChatbotSurveyReport {
    current: SurveyBlock;
    previous: SurveyBlock;
}

// ── Other Case Analysis ─────────────────────────────────────────────────────

export interface OtherCaseKpis {
    other_count: number;
}

export interface OtherCaseDailyRow {
    date: string;
    interaction: number;
    irrelevant: number;
    unmatched_anywhere: number;
}

export interface OtherCaseCharts {
    distribution: BucketCount[];
    daily: OtherCaseDailyRow[];
}

export interface OtherCaseBlock {
    kpis: OtherCaseKpis;
    charts: OtherCaseCharts;
}

export interface OhlaChatbotOtherCaseReport {
    current: OtherCaseBlock;
    previous: OtherCaseBlock;
}

// ── View discriminator + report type union ──────────────────────────────────

export type OhlaChatbotView =
    | 'overview'
    | 'user-ask'
    | 'agent-support'
    | 'survey'
    | 'other-case';

export interface OhlaChatbotReportByView {
    overview: OhlaChatbotOverviewReport;
    'user-ask': OhlaChatbotUserAskReport;
    'agent-support': OhlaChatbotAgentSupportReport;
    survey: OhlaChatbotSurveyReport;
    'other-case': OhlaChatbotOtherCaseReport;
}

// ── Fetchers ────────────────────────────────────────────────────────────────

export interface ReportRangeParams {
    /** YYYY-MM-DD inclusive UTC start day */
    date_from: string;
    /** YYYY-MM-DD inclusive UTC end day */
    date_to: string;
    /**
     * Optional view-specific extra query params (e.g. survey filters
     * vip/bg/country/rate_min/rate_max). The proxy forwards them through.
     */
    extra?: Record<string, string>;
}

async function fetchReport<V extends OhlaChatbotView>(
    view: V,
    { date_from, date_to, extra }: ReportRangeParams,
): Promise<OhlaChatbotReportByView[V]> {
    const params = new URLSearchParams({ date_from, date_to });
    if (extra) {
        for (const [k, v] of Object.entries(extra)) {
            if (v !== undefined && v !== null && v !== '') params.append(k, v);
        }
    }
    // Routed through the dedicated proxy at app/api/ohla-chatbot/report/[view]/route.ts.
    // The default /api/objects/[resource] proxy can't accept multi-segment paths.
    const url = `/api/ohla-chatbot/report/${view}?${params.toString()}`;
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) {
        if (resp.status === 401) throw new Error('Not authenticated');
        const body = await resp.text().catch(() => '');
        throw new Error(`ohla-chatbot/${view} fetch failed: ${resp.status} ${body.slice(0, 200)}`);
    }
    return (await resp.json()) as OhlaChatbotReportByView[V];
}

export const fetchOhlaChatbotOverview = (p: ReportRangeParams) =>
    fetchReport('overview', p);

export const fetchOhlaChatbotUserAsk = (p: ReportRangeParams) =>
    fetchReport('user-ask', p);

export const fetchOhlaChatbotAgentSupport = (p: ReportRangeParams) =>
    fetchReport('agent-support', p);

export const fetchOhlaChatbotSurvey = (p: ReportRangeParams) =>
    fetchReport('survey', p);

export const fetchOhlaChatbotOtherCase = (p: ReportRangeParams) =>
    fetchReport('other-case', p);

export { fetchReport as fetchOhlaChatbotReport };
