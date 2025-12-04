import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'

const AUTH_URL = RUNTIME_CONFIG.auth.serviceUrl
const ACCESS_TOKEN_COOKIE = 'it_aware_access'

export async function GET() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)

    if (!accessToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Forward request to backend with all cookies
    const cookieHeader = cookieStore
      .getAll()
      .map(c => `${c.name}=${c.value}`)
      .join('; ')

    const response = await fetch(`${AUTH_URL}/auth/me`, {
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

    return NextResponse.json(await response.json())
  } catch (error) {
    console.error('[API /auth/me] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
