import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIdentityFromHeaders, type TaihuHeaders } from '@/lib/auth/taihu'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'

const BACKEND_DOMAIN = RUNTIME_CONFIG.backend.domain

// Cookie names
const COOKIES = {
  ACCESS: 'it_aware_access',
  REFRESH: 'it_aware_refresh',
  LOGGED_OUT: 'it_aware_logged_out',
  USER_DATA: 'it_aware_user_data',
} as const

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login']

// --- Helper Functions ---

function extractTaihuHeaders(request: NextRequest): TaihuHeaders {
  return {
    'x-tai-identity': request.headers.get('x-tai-identity') || undefined,
    timestamp: request.headers.get('timestamp') || undefined,
    signature: request.headers.get('signature') || undefined,
    'x-rio-seq': request.headers.get('x-rio-seq') || undefined,
  }
}

function shouldSkipMiddleware(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    PUBLIC_ROUTES.includes(pathname)
  )
}

async function fetchJwtTokens(username: string): Promise<Response> {
  return fetch(`${BACKEND_DOMAIN}/auth/session/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username }),
  })
}

async function fetchUserData(accessTokenCookie: string): Promise<object | null> {
  try {
    const response = await fetch(`${BACKEND_DOMAIN}/auth/me`, {
      method: 'GET',
      headers: { 'Cookie': accessTokenCookie.split(';')[0] },
    })
    return response.ok ? await response.json() : null
  } catch {
    return null
  }
}

function forwardAuthCookies(response: NextResponse, setCookies: string[]): void {
  for (const cookieStr of setCookies) {
    response.headers.append('Set-Cookie', cookieStr)
  }
}

function setUserDataCookie(response: NextResponse, userData: object): void {
  const encoded = encodeURIComponent(JSON.stringify(userData))
  response.headers.append('Set-Cookie', `${COOKIES.USER_DATA}=${encoded}; Path=/; Max-Age=30; SameSite=lax`)
}

// --- Main Middleware ---

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)

  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next()
  }

  const hasAccessToken = request.cookies.has(COOKIES.ACCESS)
  const hasLoggedOut = request.cookies.has(COOKIES.LOGGED_OUT)
  const taihuHeaders = extractTaihuHeaders(request)
  // Skip Taihu headers check for public routes (like /login) to allow username/password auth
  const hasTaihuHeaders = !isPublicRoute && !!taihuHeaders['x-tai-identity']

  // Redirect to login if not authenticated (skip for public routes)
  if (!isPublicRoute && !hasAccessToken && !hasTaihuHeaders) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect logged-out users without SSO headers to login
  if (hasLoggedOut && !hasTaihuHeaders) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const response = NextResponse.next()

  // Skip Taihu SSO authentication for public routes (allow username/password login)
  if (isPublicRoute) {
    return response
  }

  // Process Taihu SSO authentication
  if (hasTaihuHeaders) {
    try {
      const identity = await getIdentityFromHeaders(taihuHeaders)
      
      // Set user info headers
      response.headers.set('x-user-staff-id', identity.staffId.toString())
      response.headers.set('x-user-login-name', identity.loginName)

      // Determine if we need to fetch new JWT tokens
      const needsNewTokens = !hasAccessToken || (hasLoggedOut && !hasAccessToken)
      const skipTokenFetch = hasLoggedOut && hasAccessToken

      if (skipTokenFetch) {
        // User logged out but still has valid token - respect logout
        return response
      }

      if (needsNewTokens) {
        const authResponse = await fetchJwtTokens(identity.loginName)

        if (authResponse.ok) {
          const setCookies = authResponse.headers.getSetCookie()
          forwardAuthCookies(response, setCookies)

          // Clear logged_out cookie on re-authentication
          if (hasLoggedOut) {
            response.cookies.delete(COOKIES.LOGGED_OUT)
          }

          // Fetch and set user data for immediate client hydration
          const accessTokenCookie = setCookies.find(c => c.startsWith(`${COOKIES.ACCESS}=`))
          if (accessTokenCookie) {
            const userData = await fetchUserData(accessTokenCookie)
            if (userData) {
              setUserDataCookie(response, userData)
            }
          }
        }
      }
    } catch (error) {
      console.error('[Middleware] Taihu auth failed:', error)
      // Always redirect to login when Taihu headers are present but invalid
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed'
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', errorMessage)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export default middleware

export const config = {
  matcher: ['/((?!api/|_next/|_vercel/|.*\\..*).*)'],
}
