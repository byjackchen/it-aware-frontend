/**
 * TypeScript interfaces for Survey Analytics Dashboard API responses.
 */

export interface ServiceNowQualityMonth {
    month: string;
    ticket_count: number;
    poor_ticket_count: number;
    feedback_ticket_count: number;
    feedback_count: number;
    rating_count: number;
    rating_sum: number;
    poor_count: number;
    csat: number | null;
    poor_rate: number | null;
    feedback_rate: number | null;
}

export interface ServiceNowQualityReport {
    batch_oid: string;
    numerator_date: 'opened' | 'closed' | 'taken_on';
    denominator_date: 'opened' | 'closed';
    csat_numerator_date: 'opened' | 'closed' | 'taken_on';
    csat_denominator_date: 'opened' | 'closed' | 'taken_on';
    poor_numerator_date: 'opened' | 'closed' | 'taken_on';
    poor_denominator_date: 'opened' | 'closed';
    feedback_numerator_date: 'opened' | 'closed' | 'taken_on';
    feedback_denominator_date: 'opened' | 'closed';
    months: ServiceNowQualityMonth[];
    averages: {
        csat: number | null;
        poor_rate: number | null;
        feedback_rate: number | null;
    };
}

export interface ServiceNowAssessmentDetail {
    oid: string;
    external_id: string | null;
    submitted_at: string;
    source_taken_on: string | null;
    rating: number | null;
    survey_questions: Record<string, unknown>;
    survey_answer: Record<string, unknown>;
}

export interface ServiceNowTicketDetail {
    oid: string;
    stable_id: string;
    title: string;
    state: string;
    source_opened_at: string | null;
    source_closed_at: string | null;
    caller_name: string | null;
    assigned_group: string | null;
    assessments: ServiceNowAssessmentDetail[];
}

export interface ServiceNowMonthDetails {
    month: string;
    ticket_count: number;
    assessment_count: number;
    filtered_ticket_count: number;
    tickets: ServiceNowTicketDetail[];
}

// ==================== Submission Overview ====================

export interface SubmissionOverviewBatch {
    oid: string;
    name: string;
    status: string;
    total_count: number;
}

export interface SubmissionStatusCounts {
    submitted: number;
    not_started: number;
    revoked: number;
    expired: number;
    total: number;
}

export interface GeoDistributionItem {
    location_oid: string;
    location_name: string;
    region: string;
    submitted_count: number;
    total_count: number;
    response_rate: number;
}

export interface SubmissionOverviewResponse {
    generated_at: string;
    batch: SubmissionOverviewBatch;
    status_counts: SubmissionStatusCounts;
    response_rate: number;
    geo_distribution: GeoDistributionItem[];
}
