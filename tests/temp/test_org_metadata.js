/**
 * Test script for Organization metadata API
 * 
 * Usage: IT_AWARE_ENV=local node tests/temp/test_org_metadata.js
 * 
 * Loads configuration from .env.{IT_AWARE_ENV} file
 */

const fs = require('fs');
const path = require('path');

// =============================================================================
// Configuration
// =============================================================================

const IT_AWARE_ENV = process.env.IT_AWARE_ENV || 'local';
const ENV_FILE = path.join(__dirname, '../../', `.env.${IT_AWARE_ENV}`);

// Load environment variables from .env file
function loadEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
        console.error(`Error: Environment file not found: ${filePath}`);
        console.error(`Available environments: local, dev`);
        process.exit(1);
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const env = {};

    content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            env[key] = valueParts.join('=');
        }
    });

    return env;
}

const config = loadEnvFile(ENV_FILE);
const BASE_URL = config.BACKEND_DOMAIN;

console.log(`Environment: ${IT_AWARE_ENV}`);
console.log(`Backend URL: ${BASE_URL}`);
console.log('');

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_ORG_OID = 'AZuzT9atJMOsEGu7fQk65g';
const TEST_USER = 'byjackchen';

// =============================================================================
// API Helper
// =============================================================================

async function getAuthToken(username) {
    const response = await fetch(`${BASE_URL}/auth/session/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'sso', username })
    });

    const setCookieHeader = response.headers.get('set-cookie');
    const match = setCookieHeader?.match(/it_aware_access=([^;]+)/);

    if (!match) {
        const body = await response.json().catch(() => ({}));
        throw new Error(`Auth failed: ${JSON.stringify(body)}`);
    }

    return match[1];
}

function createApiClient(token) {
    return async function apiCall(method, path, body = null) {
        const options = {
            method,
            headers: {
                'Cookie': `it_aware_access=${token}`,
                'Content-Type': 'application/json'
            }
        };
        if (body) {
            options.body = JSON.stringify(body);
        }
        const response = await fetch(`${BASE_URL}${path}`, options);
        return response.json();
    };
}

// =============================================================================
// Test Cases
// =============================================================================

async function main() {
    console.log('=== 1. Authenticate ===');
    const token = await getAuthToken(TEST_USER);
    console.log(`Token obtained (length: ${token.length})`);
    console.log('');

    const api = createApiClient(token);

    console.log('=== 2. GET organization (check metadata field) ===');
    const org1 = await api('GET', `/hierarchies/organizations/${TEST_ORG_OID}`);
    console.log(JSON.stringify(org1, null, 2));
    console.log('');

    console.log('=== 3. PUT update with metadata ===');
    const updateResult = await api('PUT', `/hierarchies/organizations/${TEST_ORG_OID}`, {
        metadata: { test_key: 'test_value', number: 123 }
    });
    console.log(JSON.stringify(updateResult, null, 2));
    console.log('');

    console.log('=== 4. GET verify metadata saved ===');
    const org2 = await api('GET', `/hierarchies/organizations/${TEST_ORG_OID}`);
    console.log(JSON.stringify(org2, null, 2));
    console.log('');

    // Validation
    if (org2.metadata?.test_key === 'test_value') {
        console.log('✅ SUCCESS: Metadata saved and retrieved correctly');
    } else if (org2.metadata === undefined) {
        console.log('❌ FAIL: metadata field not in response (backend issue)');
    } else {
        console.log('❌ FAIL: metadata not saved correctly');
        console.log('Expected: {"test_key": "test_value", "number": 123}');
        console.log('Got:', org2.metadata);
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
