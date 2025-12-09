import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'

const BACKEND_DOMAIN = RUNTIME_CONFIG.backend.domain
const ACCESS_TOKEN_COOKIE = 'it_aware_access'

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
function logNonAsciiInObject(obj: Record<string, unknown>, prefix: string): void {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const check = hasNonAscii(value)
      if (check.hasNonAscii) {
        console.log(`[API /auth/me] Non-ASCII found in ${prefix}.${key}: index=${check.firstNonAsciiIndex}, charCode=${check.charCode}, char='${check.char}', valueLength=${value.length}`)
      }
    } else if (typeof value === 'object' && value !== null) {
      logNonAsciiInObject(value as Record<string, unknown>, `${prefix}.${key}`)
    }
  }
}

export async function GET() {
  console.log('[API /auth/me] Request started')
  
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)
    
    console.log(`[API /auth/me] Access token present: ${!!accessToken}`)

    if (!accessToken) {
      console.log('[API /auth/me] No access token, returning 401')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Forward request to backend with all cookies
    const allCookies = cookieStore.getAll()
    console.log(`[API /auth/me] Total cookies count: ${allCookies.length}`)
    
    // Log each cookie name and check for non-ASCII in values
    for (const cookie of allCookies) {
      const nameCheck = hasNonAscii(cookie.name)
      const valueCheck = hasNonAscii(cookie.value)
      console.log(`[API /auth/me] Cookie '${cookie.name}': nameLen=${cookie.name.length}, valueLen=${cookie.value.length}, nameHasNonAscii=${nameCheck.hasNonAscii}, valueHasNonAscii=${valueCheck.hasNonAscii}`)
      if (nameCheck.hasNonAscii) {
        console.log(`[API /auth/me] Cookie name non-ASCII: index=${nameCheck.firstNonAsciiIndex}, charCode=${nameCheck.charCode}`)
      }
      if (valueCheck.hasNonAscii) {
        console.log(`[API /auth/me] Cookie value non-ASCII: index=${valueCheck.firstNonAsciiIndex}, charCode=${valueCheck.charCode}`)
      }
    }
    
    const cookieHeader = allCookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ')
    
    console.log(`[API /auth/me] Cookie header length: ${cookieHeader.length}`)
    const cookieHeaderCheck = hasNonAscii(cookieHeader)
    if (cookieHeaderCheck.hasNonAscii) {
      console.log(`[API /auth/me] Cookie header has non-ASCII at index ${cookieHeaderCheck.firstNonAsciiIndex}, charCode=${cookieHeaderCheck.charCode}, char='${cookieHeaderCheck.char}'`)
    }

    console.log(`[API /auth/me] Fetching from backend: ${BACKEND_DOMAIN}/auth/me`)
    
    const response = await fetch(`${BACKEND_DOMAIN}/auth/me`, {
      method: 'GET',
      headers: { Cookie: cookieHeader },
    })

    console.log(`[API /auth/me] Backend response status: ${response.status}`)

    if (!response.ok) {
      const status = response.status
      console.log(`[API /auth/me] Backend returned error status: ${status}`)
      if (status === 401) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Failed to fetch user info' }, { status })
    }

    const userData = await response.json()
    console.log(`[API /auth/me] Backend response data keys: ${Object.keys(userData).join(', ')}`)
    
    // Check for non-ASCII characters in the response data
    logNonAsciiInObject(userData as Record<string, unknown>, 'userData')
    
    // Safely stringify userData to check for issues
    try {
      const jsonString = JSON.stringify(userData)
      console.log(`[API /auth/me] JSON string length: ${jsonString.length}`)
      const jsonCheck = hasNonAscii(jsonString)
      if (jsonCheck.hasNonAscii) {
        console.log(`[API /auth/me] JSON has non-ASCII at index ${jsonCheck.firstNonAsciiIndex}, charCode=${jsonCheck.charCode}, char='${jsonCheck.char}'`)
      }
    } catch (stringifyError) {
      console.error('[API /auth/me] Failed to stringify userData:', stringifyError)
    }

    console.log('[API /auth/me] Returning successful response')
    return NextResponse.json(userData)
  } catch (error) {
    console.error('[API /auth/me] Error:', error)
    console.error('[API /auth/me] Error type:', error?.constructor?.name)
    console.error('[API /auth/me] Error message:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error('[API /auth/me] Error stack:', error.stack)
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
