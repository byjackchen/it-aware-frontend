import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Unit tests for pure logic only — the e2e suite (Playwright, `npm run test:e2e`)
 * covers anything that needs a browser or a running app.
 *
 * Scoped to `lib/**` deliberately: `include` must not swallow the Playwright
 * specs under `tests/`, which vitest cannot run.
 */
export default defineConfig({
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./', import.meta.url)),
        },
    },
    test: {
        environment: 'node',
        include: ['lib/**/*.test.ts'],
    },
});
