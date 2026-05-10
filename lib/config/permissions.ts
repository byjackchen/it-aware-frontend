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
    NAVIGATION_AGENT_OPS: 'ui:navigation:agent_ops',
    NAVIGATION_SSC: 'ui:navigation:ssc',
    NAVIGATION_OPERATION: 'ui:navigation:operation',
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
    WORKERS_READ_SENSITIVE: 'objects:workers:read_sensitive',
    WORKERS_EDIT_SENSITIVE: 'objects:workers:edit_sensitive',
    HARDWARES_READ: 'objects:hardwares:read',
    HARDWARES_WRITE: 'objects:hardwares:write',
    AGENTS_READ: 'objects:agents:read',
    AGENTS_WRITE: 'objects:agents:write',
    TICKETS_READ: 'objects:tickets:read',
    TICKETS_WRITE: 'objects:tickets:write',
    WORKER_HIERARCHY_ROLES_READ: 'objects:worker_hierarchy_roles:read',
    WORKER_HIERARCHY_ROLES_EDIT: 'objects:worker_hierarchy_roles:edit',
    ARTICLES_READ: 'objects:articles:read',
    ARTICLES_WRITE: 'objects:articles:write',
    INCIDENTS_READ: 'objects:incidents:read',
    INCIDENTS_WRITE: 'objects:incidents:write',
    REQUESTS_READ: 'objects:requests:read',
    REQUESTS_WRITE: 'objects:requests:write',
    INTERACTIONS_READ: 'objects:interactions:read',
    INTERACTIONS_WRITE: 'objects:interactions:write',
    SYSTEMS_READ: 'objects:systems:read',
    SYSTEMS_WRITE: 'objects:systems:write',
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
  // Networks domain permissions (iOA scans, future network telemetry)
  NETWORKS: {
    IOA_SCANS_READ: 'networks:ioa_scans:read',
    IOA_SCANS_TRIGGER: 'networks:ioa_scans:trigger',
  },
} as const;

// Type for all permission values
export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS][keyof typeof PERMISSIONS[keyof typeof PERMISSIONS]];
