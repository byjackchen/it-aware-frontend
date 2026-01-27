/**
 * Centralized permission constants for the application.
 * Permission pattern: {domain}:{resource}:{action}
 * - domain: Functional area (e.g., auth, security, persona)
 * - resource: Specific resource or module (e.g., all, threats, profile)
 * - action: Operation type (e.g., read, edit, manage)
 */

export const PERMISSIONS = {
  // UI Navigation permissions
  UI: {
    NAVIGATION_DEFAULT: 'ui:navigation:default',
    NAVIGATION_AUTH: 'ui:navigation:auth',
    NAVIGATION_PERSONA: 'ui:navigation:persona',
    NAVIGATION_KNOWLEDGE: 'ui:navigation:knowledge',
    NAVIGATION_DATA: 'ui:navigation:data',
  },
  // Objects domain permissions
  OBJECTS: {
    ORGANIZATIONS_READ: 'objects:organizations:read',
    ORGANIZATIONS_EDIT: 'objects:organizations:edit',
    LOCATIONS_READ: 'objects:locations:read',
    LOCATIONS_EDIT: 'objects:locations:edit',
    SERVICE_CATALOGS_READ: 'objects:service_catalogs:read',
    SERVICE_CATALOGS_EDIT: 'objects:service_catalogs:edit',
    WORKERS_READ: 'objects:workers:read',
    WORKERS_EDIT: 'objects:workers:edit',
    WORKER_HIERARCHY_ROLES_READ: 'objects:worker_hierarchy_roles:read',
    WORKER_HIERARCHY_ROLES_EDIT: 'objects:worker_hierarchy_roles:edit',
    TICKETS_READ: 'objects:tickets:read',
    TICKETS_WRITE: 'objects:tickets:write',
  },
} as const;

// Type for all permission values
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS][keyof typeof PERMISSIONS[keyof typeof PERMISSIONS]];
