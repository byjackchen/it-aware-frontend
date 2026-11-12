import crypto from 'crypto';
import * as jose from 'jose';
import { afterEach, describe, expect, it } from 'vitest';
import { getIdentityFromHeaders, getUserIdentity } from '@/lib/auth/taihu';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

// A fake 32-byte Taihu key; the real one is only in the environment's Secret.
const KEY = 'gate-fake-taihu-key-not-real-32b';
const original = RUNTIME_CONFIG.taihu.paasToken;

afterEach(() => {
    RUNTIME_CONFIG.taihu.paasToken = original;
});

async function gatewayHeaders(loginName: string, key = KEY) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const seq = 'seq-1';
    const signature = crypto
        .createHash('sha256')
        .update(timestamp + key + [seq, '', '', ''].join(',') + timestamp)
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
        .encrypt(Buffer.from(key));
    return { 'x-tai-identity': identity, timestamp, signature, 'x-rio-seq': seq };
}

describe('Taihu identity', () => {
    it('verifies the gateway signature and decrypts the identity', async () => {
        RUNTIME_CONFIG.taihu.paasToken = KEY;
        await expect(getIdentityFromHeaders(await gatewayHeaders('gate.alice'))).resolves.toEqual({
            staffId: 7,
            loginName: 'gate.alice',
        });
    });

    it('refuses everything when the key is not set (no mock-token default)', async () => {
        RUNTIME_CONFIG.taihu.paasToken = '';
        await expect(getUserIdentity(await gatewayHeaders('gate.alice'))).rejects.toThrow(
            'TAIHU_PAAS_TOKEN is not set',
        );
    });

    it('refuses a signature made with another key', async () => {
        RUNTIME_CONFIG.taihu.paasToken = KEY;
        const headers = await gatewayHeaders('gate.alice', 'another-fake-key-not-real-32byte');
        await expect(getIdentityFromHeaders(headers)).rejects.toThrow('Invalid signature');
    });
});
