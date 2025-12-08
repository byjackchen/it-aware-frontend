/**
 * Centralized permission constants for the application.
 * Permission pattern: {domain}:{resource}:{action}
 * - domain: Functional area (e.g., auth, security, persona)
 * - resource: Specific resource or module (e.g., all, threats, profile)
 * - action: Operation type (e.g., read, edit, manage)
 */

export const PERMISSIONS = {
  // Persona domain
  UI: {
    NAVIGATION_DEFAULT: 'ui:navigation:default',
    NAVIGATION_SECURITY: 'ui:navigation:security',
    NAVIGATION_PERSONA: 'ui:navigation:persona',
    NAVIGATION_KNOWLEDGE: 'ui:navigation:knowledge',
  },
} as const;

// Type for all permission values
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS][keyof typeof PERMISSIONS[keyof typeof PERMISSIONS]];
