import * as jose from 'jose'
import crypto from 'crypto'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'

export interface TaihuHeaders {
    'x-tai-identity'?: string
    timestamp?: string
    signature?: string
    'x-rio-seq'?: string
}

export interface TaihuIdentity {
    staffId: number
    loginName: string
}

interface JWEPayload {
    StaffId: number
    LoginName: string
    Expiration: string
}

/**
 * Decode and decrypt the x-tai-identity header using JWE
 */
async function decodeAuthorizationHeader(header: string, keyBytes: Buffer): Promise<JWEPayload> {
    const dec = await jose.compactDecrypt(header, keyBytes)
    const payload = JSON.parse(new TextDecoder().decode(dec.plaintext)) as JWEPayload

    const exp = new Date(payload.Expiration)
    if (Date.now() - 3 * 60 * 1000 > exp.getTime()) {
        throw new Error('Token expired')
    }
    return payload
}

/**
 * Check signature validity for Taihu gateway requests
 */
function checkSignature(key: string, timestamp: string, signature: string, extHeaders: string[]): boolean {
    if (!timestamp || isNaN(Number(timestamp))) return false

    // Dev: 1 hour, Prod: 3 minutes
    const maxTimeDiff = process.env.NODE_ENV === 'development' ? 3600000 : 180000
    const timeDiff = Math.abs(parseInt(timestamp, 10) * 1000 - Date.now())
    if (timeDiff > maxTimeDiff) return false

    const dataToSign = timestamp + key + extHeaders.join(',') + timestamp
    const expectedSignature = crypto.createHash('sha256').update(dataToSign).digest('hex').toLowerCase()
    return signature.toLowerCase() === expectedSignature
}

/**
 * Extract and verify user identity from Taihu gateway headers
 */
export async function getIdentityFromHeaders(headers: TaihuHeaders): Promise<TaihuIdentity> {
    const key = RUNTIME_CONFIG.taihu.paasToken
    const extHeaders = [headers['x-rio-seq'] || '', '', '', '']

    if (!checkSignature(key, headers.timestamp || '', headers.signature || '', extHeaders)) {
        throw new Error('Invalid signature - authentication failed')
    }

    if (!headers['x-tai-identity']) {
        throw new Error('Missing x-tai-identity header')
    }

    const payload = await decodeAuthorizationHeader(headers['x-tai-identity'], Buffer.from(key))
    return { staffId: payload.StaffId, loginName: payload.LoginName }
}

/**
 * Get user identity from Taihu headers
 */
export async function getUserIdentity(headers: TaihuHeaders): Promise<TaihuIdentity> {
    if (!headers) {
        throw new Error('No headers provided for authentication')
    }
    return getIdentityFromHeaders(headers)
}
