export const RUNTIME_CONFIG = {
    app: {
        environment: process.env.NODE_ENV || 'development',
        // Deployment environment: local | dev | test | prod.
        // Defaults to 'local' so non-prod safety UI (env banner) shows
        // unless prod is explicitly configured.
        itAwareEnv: process.env.IT_AWARE_ENV || 'local',
    },
    backend: {
        // Server-side: where BFF proxy fetches from (in docker this is the
        // internal container hostname; in dev it's localhost:8007).
        domain: process.env.BACKEND_DOMAIN || 'http://localhost:8000',
        // Browser-visible: where the browser dials the backend directly
        // (e.g., for WebSocket). Falls back to BACKEND_DOMAIN when unset,
        // which is correct for local dev where both are localhost:8007.
        publicDomain:
            process.env.BACKEND_PUBLIC_DOMAIN ||
            process.env.BACKEND_DOMAIN ||
            'http://localhost:8000',
    },
    taihu: {
        paasToken: process.env.TAIHU_PAAS_TOKEN || 'mock-token',
    },
};
