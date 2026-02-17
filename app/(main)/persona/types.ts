import type { Incident, Inquiry, Interaction, Request } from '@/lib/types/objects';

export type PersonaActivityEventType = 'incident' | 'request' | 'inquiry' | 'interaction';

export interface PersonaActivityEvent {
    id: string;
    oid: string;
    type: PersonaActivityEventType;
    title: string;
    subtitle: string;
    createdAt: string;
    href: string;
    raw: Incident | Request | Inquiry | Interaction;
}

export interface TimelineWindowState {
    start: Date;
    end: Date;
    durationDays: number;
}
