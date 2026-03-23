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
    NAVIGATION_CAMPAIGN: 'ui:navigation:campaign',
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
    ARTICLES_READ: 'objects:articles:read',
    ARTICLES_WRITE: 'objects:articles:write',
    INCIDENTS_READ: 'objects:incidents:read',
    INCIDENTS_WRITE: 'objects:incidents:write',
    REQUESTS_READ: 'objects:requests:read',
    REQUESTS_WRITE: 'objects:requests:write',
    INQUIRIES_READ: 'objects:inquiries:read',
    INQUIRIES_WRITE: 'objects:inquiries:write',
    INTERACTIONS_READ: 'objects:interactions:read',
    INTERACTIONS_WRITE: 'objects:interactions:write',
    NOTIFICATION_BATCHS_READ: 'objects:notification_batchs:read',
    NOTIFICATION_BATCHS_WRITE: 'objects:notification_batchs:write',
    SURVEY_BATCHS_READ: 'objects:survey_batchs:read',
    SURVEY_BATCHS_WRITE: 'objects:survey_batchs:write',
    ANALYSISS_READ: 'objects:analysiss:read',
    ANALYSISS_WRITE: 'objects:analysiss:write',
    SCENARIOS_READ: 'objects:scenarios:read',
    SCENARIOS_WRITE: 'objects:scenarios:write',
    WORKER_CLUSTERS_READ: 'objects:worker_clusters:read',
    WORKER_CLUSTERS_WRITE: 'objects:worker_clusters:write',
  },
} as const;

// Type for all permission values
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS][keyof typeof PERMISSIONS[keyof typeof PERMISSIONS]];
