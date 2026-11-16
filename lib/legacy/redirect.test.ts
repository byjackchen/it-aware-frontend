import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { legacyRedirect } from './redirect';
import { LEGACY_REDIRECTS_ENABLED } from './switch';

const request = (path: string) => new NextRequest(`http://localhost${path}`);

afterEach(() => {
    vi.restoreAllMocks();
});

describe('the legacy redirect', () => {
    // Turned on by lane F4 with the move of the pages under /tasks/... .
    it('is switched on since the pages moved, and lets everything through when off', () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        expect(LEGACY_REDIRECTS_ENABLED).toBe(true);
        expect(legacyRedirect(request('/data/workers'))?.headers.get('location')).toBe('http://localhost/tasks/workers/workers');
        expect(legacyRedirect(request('/data/workers'), false)).toBeNull();
    });

    it('answers an old address with a temporary redirect, query kept, and logs the patterns only', () => {
        const log = vi.spyOn(console, 'info').mockImplementation(() => {});
        const response = legacyRedirect(request('/data/workers/w-1?tab=history'), true);
        expect(response?.status).toBe(307);
        expect(response?.headers.get('location')).toBe('http://localhost/tasks/workers/workers/w-1?tab=history');
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith('[legacy-redirect] old=/data/workers/[oid] new=/tasks/workers/workers/[oid]');
    });

    it('never redirects a kept address, an API address, or an address it does not know', () => {
        const log = vi.spyOn(console, 'info').mockImplementation(() => {});
        for (const path of ['/', '/home', '/access-denied', '/api', '/api/tasks/home', '/login', '/tasks/jobs']) {
            expect(legacyRedirect(request(path), true)).toBeNull();
        }
        expect(log).not.toHaveBeenCalled();
    });
});
