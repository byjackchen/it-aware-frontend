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
        // Measured by ci/gate.sh (ci/coverage/verify_coverage.py): the logic tier
        // only, as sia's workbench does. Pages, layouts and components are driven
        // through a real browser by the hermetic Playwright e2e (ci/e2e.sh).
        coverage: {
            provider: 'v8',
            include: [
                'lib/**/*.{ts,tsx}',
                'i18n/**/*.ts',
                'app/**/route.ts',
                'app/actions/**/*.ts',
                'proxy.ts',
            ],
            exclude: ['**/*.test.ts', '**/*.d.ts'],
            reporter: ['json'],
        },
    },
});
