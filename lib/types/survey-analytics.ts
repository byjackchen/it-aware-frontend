/**
 * TypeScript interfaces for Survey Analytics Dashboard API responses.
 */

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

// ==================== Shared ====================

export interface AnalysisPreview {
    oid: string;
    topic: string;
    semantic: string | null;
    intent: string | null;
    fact: string | null;
    worker_stable_id: string;
    source_oid: string | null;
}

// ==================== Analysis Classification ====================

export interface SemanticSummary {
    positive: number;
    negative: number;
    neutral: number;
}

export interface IntentSummaryItem {
    intent: string;
    count: number;
    percentage: number;
    analyses: AnalysisPreview[];
}

export interface LocationConcentration {
    location_name: string;
    count: number;
    percentage: number;
}

export interface ServiceCatalogBreakdown {
    oid: string;
    name: string;
    count: number;
    semantic: SemanticSummary;
    top_locations: LocationConcentration[];
    analyses: AnalysisPreview[];
}

export interface ConfigItemBreakdown {
    oid: string;
    name: string;
    count: number;
    semantic: SemanticSummary;
    top_locations: LocationConcentration[];
    analyses: AnalysisPreview[];
}

export interface LocationBreakdown {
    location_oid: string;
    location_name: string;
    count: number;
    semantic: SemanticSummary;
    top_issues: Array<{ name: string; count: number; type: string }>;
}

export interface AnalysisClassificationResponse {
    generated_at: string;
    total_analyses: number;
    semantic_summary: SemanticSummary;
    intent_summary: IntentSummaryItem[];
    by_service_catalog: ServiceCatalogBreakdown[];
    by_configuration_item: ConfigItemBreakdown[];
    by_location: LocationBreakdown[];
}

// ==================== Keyword Heatmap ====================

export interface KeywordItem {
    keyword: string;
    total_count: number;
    positive_count: number;
    negative_count: number;
    neutral_count: number;
    dominant_sentiment: 'positive' | 'negative' | 'neutral';
    analysis_oids: string[];
    analyses: AnalysisPreview[];
}

export interface KeywordHeatmapResponse {
    generated_at: string;
    keywords: KeywordItem[];
}
