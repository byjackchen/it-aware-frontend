import type {
    Survey,
    SurveyQuestionType,
    SurveyQuestions,
} from '@/lib/types/objects';

export type SurveyCreateEntryMode = 'guided' | 'spreadsheet';

export interface SurveyQuestionOptionDraft {
    id: string;
    option_id: string;
    label: string;
}

export interface SurveyQuestionDraft {
    id: string;
    question_id: string;
    type: SurveyQuestionType;
    title: string;
    required: boolean;
    options: SurveyQuestionOptionDraft[];
}

export interface SurveySpreadsheetRowDraft {
    name: string;
    receiverStableId: string;
    surveyQuestions: SurveyQuestions;
    sourceRow: number;
}

export interface SurveySpreadsheetRowError {
    sourceRow: number;
    receiverStableId: string;
    message: string;
}

export interface SurveySpreadsheetParseResult {
    rows: SurveySpreadsheetRowDraft[];
    totalRows: number;
    validRows: number;
    duplicateRowsIgnored: number;
    unmatchedStableIds: string[];
    rowErrors: SurveySpreadsheetRowError[];
    fatalError: string | null;
}

export interface EditableSurvey extends Survey {
    isNew?: boolean;
}
