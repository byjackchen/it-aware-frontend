import crypto from 'crypto';
import * as jose from 'jose';
import { NextRequest } from 'next/server';
import { afterEach, expect, it, vi } from 'vitest';
import middleware from '@/proxy';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

// A fake 32-byte Taihu key; the real one is only in the environment's Secret.
const KEY = 'gate-fake-taihu-key-not-real-32b';
const original = RUNTIME_CONFIG.taihu.paasToken;

afterEach(() => {
    RUNTIME_CONFIG.taihu.paasToken = original;
    vi.unstubAllGlobals();
});

async function gatewayHeaders(loginName: string) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const seq = 'seq-1';
    const signature = crypto
        .createHash('sha256')
        .update(timestamp + KEY + [seq, '', '', ''].join(',') + timestamp)
        .digest('hex');
    const identity = await new jose.CompactEncrypt(
        new TextEncoder().encode(
            JSON.stringify({
                StaffId: 7,
                LoginName: loginName,
                Expiration: new Date(Date.now() + 60_000).toISOString(),
            }),
        ),
    )
        .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
        .encrypt(Buffer.from(KEY));
    return { 'x-tai-identity': identity, timestamp, signature, 'x-rio-seq': seq };
}

// M2 (TODO00000138): the backend checks the identity itself, so the proxy sends
// the x-tai-identity it verified along with the sso grant.
it('forwards the verified Taihu identity with the sso grant', async () => {
    RUNTIME_CONFIG.taihu.paasToken = KEY;
    const headers = await gatewayHeaders('gate.alice');
    const fetchMock = vi.fn().mockResolvedValue(
        new Response(null, { status: 200, headers: { 'Set-Cookie': 'it_aware_access=t; Path=/' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await middleware(new NextRequest('http://localhost/persona', { headers }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/auth\/session\/token$/);
    const body = new URLSearchParams(String(init.body));
    expect(body.get('grant_type')).toBe('sso');
    expect(body.get('username')).toBe('gate.alice');
    expect(body.get('tai_identity')).toBe(headers['x-tai-identity']);
    expect(response.headers.getSetCookie().join(';')).toContain('it_aware_access=t');
});
