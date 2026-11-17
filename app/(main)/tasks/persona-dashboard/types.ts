import type { Incident, Interaction, Request, Survey } from '@/lib/types/objects';

export type PersonaActivityEventType = 'incident' | 'request' | 'interaction' | 'survey';

export interface PersonaActivityEvent {
    id: string;
    oid: string;
    type: PersonaActivityEventType;
    title: string;
    subtitle: string;
    createdAt: string;
    /** The record's page. */
    href: string | null;
    raw: Incident | Request | Interaction | Survey;
}

export interface TimelineWindowState {
    start: Date;
    end: Date;
    durationDays: number;
}
