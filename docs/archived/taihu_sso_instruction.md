# Taihu SSO Integration Guide

This document outlines the technical implementation of the Taihu Single Sign-On (SSO) integration. It serves as a reference for understanding how the application retrieves user identity from the Taihu gateway and can be used as a guide for similar implementations.

## Overview

The Taihu SSO mechanism relies on the Taihu gateway injecting specific HTTP headers into incoming requests. The application trusts these headers after verifying a cryptographic signature and decrypting the identity token using a shared secret.


## Configuration

To successfully decrypt/verify the headers, the application requires a shared secret key.

| Environment Variable | Description |
|----------------------|-------------|
| `TAIHU_PAAS_TOKEN` | The shared secret ("PAAS Token") used to decrypt the `x-tai-identity` header and verify the request `signature`. |

In the codebase, this is accessed via `RUNTIME_CONFIG.taihu.paasToken` (see `lib/config/runtime.ts`).

## Key Headers

The following headers are injected by the Taihu gateway:

| Header | Description | Required |
|--------|-------------|----------|
| `x-tai-identity` | Encrypted JWE (JSON Web Encryption) token containing the user identity (StaffId, LoginName). | Yes |
| `signature` | A SHA256 signature of the request metadata used to verify the request's authenticity. | Yes |
| `timestamp` | The timestamp of the request, used to prevent replay attacks (validity window is typically tight, e.g., 3 minutes). | Yes |
| `x-rio-seq` | An optional sequence number derived from the gateway, included in signature validation. | No |

## retrieving User ID (Technical Logic)

To retrieve the current user's ID (Staff ID), the application must decrypt the `x-tai-identity` header.

### 1. Decryption Process

The `x-tai-identity` header is a JWE Compact Serialization string. It must be decrypted using the **PAAS Token** (shared secret) configured in the environment.

**Algorithm:**
1.  Read `x-tai-identity` header.
2.  Decrypt using `jose.compactDecrypt` with the PAAS Token (as bytes).
3.  Decode the plaintext payload from bytes to a string, then parse as JSON.
4.  Extract `StaffId` from the payload.

### 2. Code Reference (`lib/auth/taihu.ts`)

The core logic is implemented in `lib/auth/taihu.ts`. Below is the essential logic for extracting the identity:

```typescript
import * as jose from 'jose'

interface JWEPayload {
    StaffId: number
    LoginName: string
    Expiration: string
}

async function decodeAuthorizationHeader(header: string, keyString: string): Promise<JWEPayload> {
    const keyBytes = Buffer.from(keyString)
    
    // Decrypt the JWE token
    const { plaintext } = await jose.compactDecrypt(header, keyBytes)
    
    // Decode and parse payload
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as JWEPayload
    
    // Check expiration
    const exp = new Date(payload.Expiration)
    // Allow a 3-minute skew (or development specific skew)
    if (Date.now() - 3 * 60 * 1000 > exp.getTime()) {
        throw new Error('Token expired')
    }
    
    return payload
}
```

### 3. Signature Verification

Before trusting the identity header, the application verifies the request signature to ensure it originated from the Taihu gateway.

**Verification Logic:**
1.  Construct the data string: `timestamp + key + extHeaders + timestamp`.
2.  Compute SHA256 hash of the data string.
3.  Compare computed hash with the `signature` header.

```typescript
function checkSignature(key: string, timestamp: string, signature: string, extHeaders: string[]): boolean {
    if (!timestamp) return false

    // Verify timestamp is within acceptable range (e.g., 3 minutes)
    const timeDiff = Math.abs(parseInt(timestamp, 10) * 1000 - Date.now())
    if (timeDiff > 180000) return false // 3 minutes

    const dataToSign = timestamp + key + extHeaders.join(',') + timestamp
    const expectedSignature = crypto.createHash('sha256').update(dataToSign).digest('hex').toLowerCase()
    
    return signature.toLowerCase() === expectedSignature
}
```

## Integration Points

### Middleware (`proxy.ts`)
The Next.js middleware intercepts requests to:
1.  Detect the presence of `x-tai-identity`.
2.  Validate the signature and decrypt the identity.
3.  If valid, it may perform a "shadow login" by exchanging the Taihu identity for an application session token.
4.  It sets internal headers (e.g., `x-user-staff-id`, `x-user-login-name`) for downstream consumption.

### Server-Side Usage
In server actions or components, the identity can be retrieved via `getIdentityFromHeaders` in `lib/auth/taihu.ts`, which processes the headers available in the request context.
