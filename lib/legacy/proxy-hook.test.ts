import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import middleware from '@/proxy';

// The proxy with the legacy switch turned on, as lane F4 will set it.
vi.mock('@/lib/legacy/switch', () => ({ LEGACY_REDIRECTS_ENABLED: true }));

afterEach(() => {
    vi.restoreAllMocks();
});

describe('the proxy with legacy redirects on', () => {
    it('redirects an old address before any auth work', async () => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        const fetchMock = vi.spyOn(globalThis, 'fetch');
        const response = await middleware(new NextRequest('http://localhost/operation-teams/ops-dashboard/vip-tickets'));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('http://localhost/tasks/it-tickets/vip');
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('lets a kept address through to the auth checks', async () => {
        const response = await middleware(new NextRequest('http://localhost/home'));
        expect(response.status).toBe(307);
        expect(response.headers.get('location')).toBe('http://localhost/login');
    });
});
