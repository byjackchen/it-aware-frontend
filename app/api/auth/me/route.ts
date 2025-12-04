import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'

const AUTH_URL = RUNTIME_CONFIG.auth.serviceUrl

export async function GET() {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get('it_aware_access')
    
    // Debug: log available cookies
    const allCookies = cookieStore.getAll().map(c => c.name)
    console.log('[API /auth/me] Available cookies:', allCookies)
    
    if (!accessToken) {
      console.log('[API /auth/me] No access token found, returning 401')
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Forward the request to the backend with the JWT cookie
    const cookieHeader = cookieStore.getAll()
      .map(c => `${c.name}=${c.value}`)
      .join('; ')

    const response = await fetch(`${AUTH_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
      },
    })

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        )
      }
      
      const errorText = await response.text()
      console.error('[API /auth/me] Backend error:', response.status, errorText)
      return NextResponse.json(
        { error: 'Failed to fetch user info' },
        { status: response.status }
      )
    }

    const userData = await response.json()
    console.log('[API /auth/me] User data:', JSON.stringify(userData, null, 2))
    return NextResponse.json(userData)
  } catch (error) {
    console.error('[API /auth/me] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
