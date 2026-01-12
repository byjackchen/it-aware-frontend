# Taihu SSO Integration Guide

This document outlines the technical implementation of the Taihu Single Sign-On (SSO) integration. It serves as a reference for understanding how the application retrieves and verifies user identity from the Taihu gateway.

## Overview

The Taihu SSO mechanism relies on the Taihu gateway injecting an encrypted identity token (`x-tai-identity`) into incoming requests. The application verifies the user's identity by decrypting this token using a pre-shared secret (PAAS Token). Successful decryption guarantees the authenticity of the request.

## Configuration

To successfully decrypt and verify the headers, the application requires a shared secret key.

| Environment Variable | Description |
|----------------------|-------------|
| `TAIHU_PAAS_TOKEN` | The shared secret ("PAAS Token") used to decrypt the `x-tai-identity` header. |

In the codebase, this is accessed via `process.env.TAIHU_PAAS_TOKEN` (Next.js Middleware/Edge compatible).

## Key Headers

The primary header used for authentication is:

| Header | Description | Required |
|--------|-------------|----------|
| `x-tai-identity` | Encrypted JWE (JSON Web Encryption) token containing the user identity (StaffId, LoginName). | Yes |

*Note: The gateway also sends `signature`, `timestamp`, and `x-rio-seq` headers. However, the JWE token itself provides authenticated encryption, so explicit signature verification of the request metadata is redundant and omitted in favor of strict JWE validation.*

## User Retrieval Logic

To retrieve the current user's ID, the application decrypts the `x-tai-identity` header.

### 1. Decryption & Validation Process

The `x-tai-identity` header is a JWE Compact Serialization string.
1.  **Decrypt**: The token is decrypted using the `TAIHU_PAAS_TOKEN`.
2.  **Verify**: If decryption succeeds, it confirms the token was issued by Taihu (as only the holder of the secret could have encrypted it validly).
3.  **Check Expiration**: The payload contains an `Expiration` timestamp which is checked against the current server time (with a tolerance window).

### 2. Code Reference (`lib/auth/taihu.ts`)

The implementation uses `jose` for standard JWE handling and `TextEncoder` for Edge Runtime compatibility.

```typescript
import * as jose from 'jose';

export interface JWEPayload {
    StaffId: number;
    LoginName: string;
    Expiration: string;
}

export async function decodeAuthorizationHeader(header: string, keyString: string): Promise<JWEPayload> {
    const keyBytes = new TextEncoder().encode(keyString);
    
    // Decrypt the JWE token
    // jose.compactDecrypt throws an error if decryption fails (invalid key/token)
    const { plaintext } = await jose.compactDecrypt(header, keyBytes);
    
    // Decode and parse payload
    const payload = JSON.parse(new TextDecoder().decode(plaintext)) as JWEPayload;
    
    // Check expiration
    const exp = new Date(payload.Expiration);
    // Allow a 3-minute skew as per standard Taihu guidance
    if (Date.now() - 3 * 60 * 1000 > exp.getTime()) {
        throw new Error('Token expired');
    }
    
    return payload;
}
```

## Integration Points

### Proxy (`src/proxy.ts`)

The Next.js proxy intercepts requests to perform authentication:

1.  Checks for the presence of `x-tai-identity`.
2.  Calls `decodeAuthorizationHeader` with the PAAS Token.
3.  If successful, sets internal headers for downstream consumption:
    - `x-user-staff-id`
    - `x-user-login-name`
4.  If validation fails, the request proceeds without user headers (effectively as a guest), or can be blocked depending on route requirements.

### UI Components

Components can retrieve the user identity from the request headers. For example, the `Header` component displays a user profile circle if `x-user-login-name` is present.

```typescript
// Example: Reading in a Server Component
import { headers } from 'next/headers';

const headersList = await headers();
const username = headersList.get('x-user-login-name') || undefined;
```
