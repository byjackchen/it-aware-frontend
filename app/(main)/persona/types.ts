import type { Analysis, Incident, Inquiry, Interaction, Request, Survey } from '@/lib/types/objects';

export type PersonaActivityEventType = 'incident' | 'request' | 'inquiry' | 'interaction' | 'survey' | 'analysis';

export interface PersonaActivityEvent {
    id: string;
    oid: string;
    type: PersonaActivityEventType;
    title: string;
    subtitle: string;
    createdAt: string;
    href: string;
    raw: Incident | Request | Inquiry | Interaction | Survey | Analysis;
}

export interface TimelineWindowState {
    start: Date;
    end: Date;
    durationDays: number;
}
