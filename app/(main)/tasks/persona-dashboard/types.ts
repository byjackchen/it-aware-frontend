import type { Analysis, Incident, Interaction, Request, Survey } from '@/lib/types/objects';

export type PersonaActivityEventType = 'incident' | 'request' | 'interaction' | 'survey' | 'analysis';

export interface PersonaActivityEvent {
    id: string;
    oid: string;
    type: PersonaActivityEventType;
    title: string;
    subtitle: string;
    createdAt: string;
    /** The record's page; null for a kind with no page (survey analyses, since 2026-11-16). */
    href: string | null;
    raw: Incident | Request | Interaction | Survey | Analysis;
}

export interface TimelineWindowState {
    start: Date;
    end: Date;
    durationDays: number;
}
