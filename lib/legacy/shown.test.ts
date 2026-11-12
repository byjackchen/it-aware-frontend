import { expect, it } from 'vitest';
import { showsLegacyMenu } from '@/lib/legacy/shown';

/**
 * The layout's one decision about the old-style menu (app/(main)/layout.tsx).
 * Tested here, in the unit tier: the e2e runs one backend stack with its tasks
 * switch on for every spec, and the home call is made server-side, so a spec
 * can neither turn the switch off nor make the call fail.
 */

it('shows the old-style menu when the home did not answer (switch off, or a failure)', () => {
    expect(showsLegacyMenu(null)).toBe(true);
});

it('hides it when the home answered, even with nothing pinned', () => {
    expect(showsLegacyMenu([])).toBe(false);
    expect(showsLegacyMenu(['it-incidents'])).toBe(false);
});
