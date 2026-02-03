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

export async function GET() {
  const requestId = generateRequestId()
  const startTime = Date.now()

  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Forward request to backend with all cookies
    const allCookies = cookieStore.getAll()

    // Filter to only include ASCII-safe cookies
    const asciiSafeCookies = allCookies.filter(cookie => {
      const nameCheck = hasNonAscii(cookie.name)
      const valueCheck = hasNonAscii(cookie.value)
      if (valueCheck.hasNonAscii) {
        return false // Skip cookies with non-ASCII values
      }
      if (nameCheck.hasNonAscii) {
        return false // Skip cookies with non-ASCII names
      }
      return true
    })

    const cookieHeader = asciiSafeCookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ')

    const response = await fetch(`${BACKEND_DOMAIN}/auth/me`, {
      method: 'GET',
      headers: { Cookie: cookieHeader },
    })

    if (!response.ok) {
      const status = response.status
      if (status === 401) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
      }
      return NextResponse.json({ error: 'Failed to fetch user info' }, { status })
    }

    const userData = await response.json()
    return NextResponse.json(userData)
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[APIRoute:/auth/me:${requestId}] Error after ${duration}ms:`, error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
