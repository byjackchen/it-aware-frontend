export const RUNTIME_CONFIG = {
    app: {
        environment: process.env.NODE_ENV || 'development',
    },
    auth: {
        useMockData: process.env.USE_MOCK_AUTH === 'true',
        mockUser: {
            staffId: 12345,
            loginName: 'mock.user',
        },
        serviceUrl: process.env.AUTH_SERVICE_URL || 'http://localhost:8007',
    },
    taihu: {
        paasToken: process.env.TAIHU_PAAS_TOKEN || 'mock-token',
        isSingnatured: process.env.TAIHU_CHECK_SIGNATURE === 'true',
    },
};
