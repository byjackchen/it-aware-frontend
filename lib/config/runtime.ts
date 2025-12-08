export const RUNTIME_CONFIG = {
    app: {
        environment: process.env.NODE_ENV || 'development',
    },
    backend: {
        domain: process.env.BACKEND_DOMAIN || 'http://localhost:8000',
    },
    taihu: {
        paasToken: process.env.TAIHU_PAAS_TOKEN || 'mock-token',
    },
};
