import * as jose from 'jose'
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
async function decodeAuthorizationHeader(
    authorizationHeader: string,
    keyBytes: Buffer
): Promise<JWEPayload> {
    const dec = await jose.compactDecrypt(authorizationHeader, keyBytes)
    const payload = JSON.parse(new TextDecoder().decode(dec.plaintext)) as JWEPayload

    const exp = new Date(payload.Expiration)
    // Check if token is expired, add 3 minute buffer to avoid server time differences
    if (new Date().getTime() - 3 * 60 * 1000 > exp.getTime()) {
        throw new Error('Token expired')
    }
    return payload
}

/**
 * Check signature validity for Taihu gateway requests
 */
function checkSignature(
    key: string,
    timestampSeconds: string,
    signature: string,
    extHeaders: string[]
): boolean {
    if (!timestampSeconds || isNaN(Number(timestampSeconds))) {
        return false
    }

    // Check timestamp is within 3 minutes (180 seconds)
    const timestampMs = parseInt(timestampSeconds, 10) * 1000
    if (Math.abs(timestampMs - Date.now()) > 180000) {
        return false
    }

    // Create hash for signature verification
    const crypto = require('crypto')
    const hash = crypto.createHash('sha256')
    hash.update(timestampSeconds + key + extHeaders.join(',') + timestampSeconds)

    return signature.toLowerCase() === hash.digest('hex').toLowerCase()
}

/**
 * Extract and verify user identity from Taihu gateway headers
 */
export async function getIdentityFromHeaders(
    headers: TaihuHeaders
): Promise<TaihuIdentity> {
    const config = RUNTIME_CONFIG.taihu
    const key = config.paasToken
    const keyBytes = Buffer.from(key)
    const identitySafeMode = config.isSingnatured

    // Build extended headers for signature check
    let extHeaders = [headers['x-rio-seq'] || '', '', '', '']
    if (!identitySafeMode) {
        extHeaders = [
            headers['x-rio-seq'] || '',
            '', // staffid - not available in safe mode
            '', // staffname - not available in safe mode
            '' // x-ext-data
        ]
    }

    // Verify signature
    if (!checkSignature(
        key,
        headers.timestamp || '',
        headers.signature || '',
        extHeaders
    )) {
        throw new Error('Invalid signature - authentication failed')
    }

    // Decrypt identity from x-tai-identity header
    const taiIdentity = headers['x-tai-identity']
    if (!taiIdentity) {
        throw new Error('Missing x-tai-identity header')
    }

    const payload = await decodeAuthorizationHeader(taiIdentity, keyBytes)
    return {
        staffId: payload.StaffId,
        loginName: payload.LoginName
    }
}

/**
 * Get user identity - either from headers or mock data based on config
 */
export async function getUserIdentity(headers?: TaihuHeaders): Promise<TaihuIdentity> {
    const authConfig = RUNTIME_CONFIG.auth

    // Extract from headers
    if (!headers) {
        console.error('[Taihu Auth] No headers provided', {
            runtimeConfig: RUNTIME_CONFIG
        })
        throw new Error('No headers provided for authentication')
    }

    console.log('[Taihu Auth] Extracting from headers:', Object.keys(headers))
    return getIdentityFromHeaders(headers)
}
