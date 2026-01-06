import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'

const BACKEND_DOMAIN = RUNTIME_CONFIG.backend.domain
const ACCESS_TOKEN_COOKIE = 'it_aware_access'

// Generate a short request ID for log correlation
function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 10)
}

// Helper function to check if string contains non-ASCII characters
function hasNonAscii(str: string): { hasNonAscii: boolean; firstNonAsciiIndex: number; charCode: number; char: string } {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) {
      return {
        hasNonAscii: true,
        firstNonAsciiIndex: i,
        charCode: str.charCodeAt(i),
        char: str[i]
      }
    }
  }
  return { hasNonAscii: false, firstNonAsciiIndex: -1, charCode: 0, char: '' }
}

// Helper function to safely log object properties for non-ASCII characters
function logNonAsciiInObject(obj: Record<string, unknown>, prefix: string, requestId: string): void {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const check = hasNonAscii(value)
      if (check.hasNonAscii) {
        console.log(`[APIRoute:/auth/me:${requestId}] Non-ASCII found in ${prefix}.${key}: index=${check.firstNonAsciiIndex}, charCode=${check.charCode}, char='${check.char}', valueLength=${value.length}`)
      }
    } else if (typeof value === 'object' && value !== null) {
      logNonAsciiInObject(value as Record<string, unknown>, `${prefix}.${key}`, requestId)
    }
  }
}

export async function GET() {
  const requestId = generateRequestId()
  const startTime = Date.now()
  console.log(`[APIRoute:/auth/me:${requestId}] Request started`)

  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)

    console.log(`[APIRoute:/auth/me:${requestId}] Access token present: ${!!accessToken}`)

    if (!accessToken) {
      console.log(`[APIRoute:/auth/me:${requestId}] No access token, returning 401`)
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Forward request to backend with all cookies
    const allCookies = cookieStore.getAll()
    console.log(`[APIRoute:/auth/me:${requestId}] Total cookies count: ${allCookies.length}`)
    console.log(`[APIRoute:/auth/me:${requestId}] Cookie names: ${allCookies.map(c => c.name).join(', ')}`)

    // Log each cookie name and check for non-ASCII in values
    // Also filter to only include ASCII-safe cookies
    const asciiSafeCookies = allCookies.filter(cookie => {
      const nameCheck = hasNonAscii(cookie.name)
      const valueCheck = hasNonAscii(cookie.value)
      console.log(`[APIRoute:/auth/me:${requestId}] Cookie '${cookie.name}': nameLen=${cookie.name.length}, valueLen=${cookie.value.length}, nameHasNonAscii=${nameCheck.hasNonAscii}, valueHasNonAscii=${valueCheck.hasNonAscii}`)
      if (nameCheck.hasNonAscii) {
        console.log(`[APIRoute:/auth/me:${requestId}] Cookie name non-ASCII: index=${nameCheck.firstNonAsciiIndex}, charCode=${nameCheck.charCode}`)
      }
      if (valueCheck.hasNonAscii) {
        console.log(`[APIRoute:/auth/me:${requestId}] Cookie value non-ASCII: index=${valueCheck.firstNonAsciiIndex}, charCode=${valueCheck.charCode}`)
        console.log(`[APIRoute:/auth/me:${requestId}] Skipping cookie '${cookie.name}' due to non-ASCII value`)
        return false // Skip cookies with non-ASCII values
      }
      if (nameCheck.hasNonAscii) {
        console.log(`[APIRoute:/auth/me:${requestId}] Skipping cookie '${cookie.name}' due to non-ASCII name`)
        return false // Skip cookies with non-ASCII names
      }
      return true
    })

    console.log(`[APIRoute:/auth/me:${requestId}] ASCII-safe cookies: ${asciiSafeCookies.length} of ${allCookies.length}`)

    const cookieHeader = asciiSafeCookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ')

    console.log(`[APIRoute:/auth/me:${requestId}] Cookie header length: ${cookieHeader.length}`)

    console.log(`[APIRoute:/auth/me:${requestId}] Fetching from backend: ${BACKEND_DOMAIN}/auth/me`)

    const response = await fetch(`${BACKEND_DOMAIN}/auth/me`, {
      method: 'GET',
      headers: { Cookie: cookieHeader },
    })

    console.log(`[APIRoute:/auth/me:${requestId}] Backend response status: ${response.status}`)

    if (!response.ok) {
      const status = response.status
      const duration = Date.now() - startTime
      console.log(`[APIRoute:/auth/me:${requestId}] Backend returned error status: ${status} after ${duration}ms`)
      if (status === 401) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Failed to fetch user info' }, { status })
    }

    const userData = await response.json()
    console.log(`[APIRoute:/auth/me:${requestId}] Backend response data keys: ${Object.keys(userData).join(', ')}`)

    // Check for non-ASCII characters in the response data
    logNonAsciiInObject(userData as Record<string, unknown>, 'userData', requestId)

    // Pass through backend response directly (nested format: { account, worker, permissions, groups })
    // Frontend now expects the nested format
    console.log(`[APIRoute:/auth/me:${requestId}] User: username=${userData.account?.username}, permissions count=${userData.permissions?.unconstrained?.length}`)

    // Safely stringify userData to check for issues
    try {
      const jsonString = JSON.stringify(userData)
      console.log(`[APIRoute:/auth/me:${requestId}] JSON string length: ${jsonString.length}`)
      const jsonCheck = hasNonAscii(jsonString)
      if (jsonCheck.hasNonAscii) {
        console.log(`[APIRoute:/auth/me:${requestId}] JSON has non-ASCII at index ${jsonCheck.firstNonAsciiIndex}, charCode=${jsonCheck.charCode}, char='${jsonCheck.char}'`)
      }
    } catch (stringifyError) {
      console.error(`[APIRoute:/auth/me:${requestId}] Failed to stringify userData:`, stringifyError)
    }

    const duration = Date.now() - startTime
    console.log(`[APIRoute:/auth/me:${requestId}] Returning successful response in ${duration}ms`)
    return NextResponse.json(userData)
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[APIRoute:/auth/me:${requestId}] Error after ${duration}ms:`, error)
    console.error(`[APIRoute:/auth/me:${requestId}] Error type:`, error?.constructor?.name)
    console.error(`[APIRoute:/auth/me:${requestId}] Error message:`, error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error(`[APIRoute:/auth/me:${requestId}] Error stack:`, error.stack)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
