/**
 * Type definitions for Persona Profile.
 * 
 * This represents a user-centric behavioral persona that captures:
 * - Who the person is in their daily work
 * - What they are trying to accomplish
 * - How they behave under normal and high-stress conditions
 */

import type { Worker, Organization, Location, WorkerHardware } from './objects';

// ============================================================================
// Persona Types
// ============================================================================

export interface PersonaBasicProfile {
    role: string;
    experience: string;
    workMode: string; // e.g., "Individual Contributor", "Manager"
    onCall: boolean;
}

export interface PersonaContext {
    team: string;
    product: string;
    environment: string; // e.g., "Prod-heavy", "Dev-focused"
}

export interface WorkflowPeriod {
    period: string; // e.g., "Morning", "Midday", "On Incident"
    activities: string[];
}

export interface CommunicationPreferences {
    preferred: string[];
    avoided: string[];
}

export interface PersonaSoftware {
    name: string;
    category?: string;
    isPlaceholder: boolean;
}

export interface Persona {
    // Header
    name: string;
    title: string;
    tagline: string;
    tags: string[];

    // Sidebar - Basic Profile
    basicProfile: PersonaBasicProfile;

    // Sidebar - Context
    context: PersonaContext;

    // Sidebar - Softwares (placeholder for now)
    softwares: PersonaSoftware[];

    // Sidebar - Hardwares (from WorkerHardware API)
    hardwares: WorkerHardware[];

    // Main View Sections
    goalsMotivations: string[];
    painPoints: string[];
    dailyWorkflow: WorkflowPeriod[];
    behaviorPatterns: string[];
    communicationPreferences: CommunicationPreferences;
    notes: string[];
}

// ============================================================================
// Helper to build Persona from Worker data
// ============================================================================

/**
 * Build a Persona from available Worker, Organization, Location, and Hardware data.
 * Fields without backend support are marked as placeholders.
 */
export function buildPersonaFromWorker(
    worker: Worker,
    organization?: Organization | null,
    location?: Location | null,
    hardwares?: WorkerHardware[]
): Persona {
    const fullName = worker.fullname;

    // Build tags from available worker data
    const tags: string[] = [];
    if (worker.management_level) {
        tags.push(worker.management_level);
    }
    if (worker.professional_level) {
        tags.push(worker.professional_level);
    }
    if (worker.is_active) {
        tags.push('Active');
    }

    return {
        // Header - from Worker data
        name: fullName,
        title: worker.professional_level || '[Title - Placeholder]',
        tagline: '[Persona tagline - Placeholder: Add a brief quote or description]',
        tags: tags.length > 0 ? tags : ['[Tag - Placeholder]'],

        // Basic Profile - partially from Worker
        basicProfile: {
            role: worker.professional_level || '[Role - Placeholder]',
            experience: '[Experience - Placeholder]',
            workMode: worker.management_level?.toLowerCase().includes('manager')
                ? 'Manager'
                : 'Individual Contributor',
            onCall: false, // Placeholder - no backend support
        },

        // Context - from Organization and Location
        context: {
            team: organization?.name || '[Team - Placeholder]',
            product: '[Product - Placeholder]',
            environment: location?.name || '[Environment - Placeholder]',
        },

        // Softwares - Placeholder (no backend support yet)
        softwares: [
            { name: '[Software 1 - Placeholder]', isPlaceholder: true },
            { name: '[Software 2 - Placeholder]', isPlaceholder: true },
        ],

        // Hardwares - from WorkerHardware API
        hardwares: hardwares || [],

        // Main View - All placeholders (no backend support yet)
        goalsMotivations: [
            '[Goal 1 - Placeholder: What does this person want to achieve?]',
            '[Goal 2 - Placeholder: What motivates them?]',
        ],

        painPoints: [
            '[Pain Point 1 - Placeholder: What frustrates this person?]',
            '[Pain Point 2 - Placeholder: What blocks their progress?]',
        ],

        dailyWorkflow: [
            {
                period: 'Morning',
                activities: ['[Activity - Placeholder: What do they do first?]'],
            },
            {
                period: 'Midday',
                activities: ['[Activity - Placeholder: Core work activities]'],
            },
        ],

        behaviorPatterns: [
            '[Behavior 1 - Placeholder: How do they interact with systems?]',
            '[Behavior 2 - Placeholder: What patterns do they exhibit?]',
        ],

        communicationPreferences: {
            preferred: [
                '[Preferred 1 - Placeholder: How do they like to receive info?]',
            ],
            avoided: [
                '[Avoided 1 - Placeholder: What communication styles to avoid?]',
            ],
        },

        notes: [
            '[Note - Placeholder: Interview insights, observations, open questions]',
        ],
    };
}
