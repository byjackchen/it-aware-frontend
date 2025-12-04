export const RUNTIME_CONFIG = {
    app: {
        environment: process.env.NODE_ENV || 'development',
    },
    auth: {
        serviceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:8007',
    },
    taihu: {
        paasToken: process.env.TAIHU_PAAS_TOKEN || 'mock-token',
    },
};
