import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIdentityFromHeaders, type TaihuHeaders } from '@/lib/auth/taihu'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'

const BACKEND_DOMAIN = RUNTIME_CONFIG.backend.domain

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

// Helper function to safely encode non-ASCII string for HTTP headers
function encodeForHeader(str: string): string {
  const check = hasNonAscii(str)
  return check.hasNonAscii ? encodeURIComponent(str) : str
}

// Cookie names
const COOKIES = {
  ACCESS: 'it_aware_access',
  REFRESH: 'it_aware_refresh',
  USER_DATA: 'it_aware_user_data',
  // Single cookie to track authentication mode (replaces logged_out, sso_user, password_login)
  AUTH_MODE: 'it_aware_auth_mode',
} as const

// Authentication mode values
const AUTH_MODES = {
  SSO: 'sso',           // User authenticated via Taihu SSO
  PASSWORD: 'password', // User authenticated via username/password
  LOGGED_OUT: 'logged_out', // User explicitly logged out
} as const

type AuthMode = typeof AUTH_MODES[keyof typeof AUTH_MODES] | null

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login']

// --- Helper Functions ---

// Helper to extract username from JWT token (without verification - just for comparison)
function extractUsernameFromJwt(token: string): string | null {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) return null

    // Decode payload (base64url)
    const payload = parts[1]
    const decoded = Buffer.from(payload, 'base64url').toString('utf-8')
    const parsed = JSON.parse(decoded)

    // Common JWT claims for username: sub, username, preferred_username
    return parsed.sub || parsed.username || parsed.preferred_username || null
  } catch {
    return null
  }
}

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
    body: new URLSearchParams({ grant_type: 'sso', username }),
  })
}

async function fetchUserData(accessTokenCookie: string, requestId: string): Promise<object | null> {
  try {
    const cookieValue = accessTokenCookie.split(';')[0]
    const response = await fetch(`${BACKEND_DOMAIN}/auth/me`, {
      method: 'GET',
      headers: { 'Cookie': cookieValue },
    })

    if (response.ok) {
      return await response.json()
    }

    console.error(`[Middleware:${requestId}] fetchUserData: Backend returned ${response.status}`)
    return null
  } catch (error) {
    console.error(`[Middleware:${requestId}] fetchUserData: Exception`, error)
    return null
  }
}

function forwardAuthCookies(response: NextResponse, setCookies: string[]): void {
  for (const cookieStr of setCookies) {
    response.headers.append('Set-Cookie', cookieStr)
  }
}

function setUserDataCookie(response: NextResponse, userData: object, requestId: string): void {
  try {
    const jsonString = JSON.stringify(userData)
    const encoded = Buffer.from(jsonString).toString('base64')
    response.headers.append('Set-Cookie', `${COOKIES.USER_DATA}=${encoded}; Path=/; Max-Age=30; SameSite=lax`)
  } catch (error) {
    console.error(`[Middleware:${requestId}] setUserDataCookie error:`, error)
    throw error
  }
}

// --- Main Middleware ---

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname)
  const requestId = Math.random().toString(36).substring(7) // For log correlation

  if (shouldSkipMiddleware(pathname)) {
    return NextResponse.next()
  }

  const hasAccessToken = request.cookies.has(COOKIES.ACCESS)
  const authMode = request.cookies.get(COOKIES.AUTH_MODE)?.value as AuthMode
  const taihuHeaders = extractTaihuHeaders(request)
  // Skip Taihu headers check for public routes (like /login) to allow username/password auth
  const hasTaihuHeaders = !isPublicRoute && !!taihuHeaders['x-tai-identity']

  // Redirect to login if not authenticated (skip for public routes)
  if (!isPublicRoute && !hasAccessToken && !hasTaihuHeaders) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect logged-out users without SSO headers to login
  if (authMode === AUTH_MODES.LOGGED_OUT && !hasTaihuHeaders) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const response = NextResponse.next()

  // Skip Taihu SSO authentication for public routes (allow username/password login)
  if (isPublicRoute) {
    return response
  }

  // Process Taihu SSO authentication
  // Skip if user explicitly logged in via username/password (password login takes precedence)
  if (hasTaihuHeaders && authMode !== AUTH_MODES.PASSWORD) {
    try {
      const identity = await getIdentityFromHeaders(taihuHeaders)

      // Set user info headers (encode to handle non-ASCII characters)
      try {
        response.headers.set('x-user-staff-id', identity.staffId.toString())
        // Encode loginName to handle potential non-ASCII characters
        const encodedLoginName = encodeForHeader(identity.loginName)
        response.headers.set('x-user-login-name', encodedLoginName)
      } catch (headerError) {
        console.error(`[Middleware:${requestId}] Failed to set headers:`, headerError)
        throw headerError
      }

      // Determine if we need to fetch new JWT tokens
      // Check for identity mismatch: if Taihu says user is X but JWT belongs to Y
      let identityMismatch = false
      if (hasAccessToken) {
        const accessTokenValue = request.cookies.get(COOKIES.ACCESS)?.value
        if (accessTokenValue) {
          const jwtUsername = extractUsernameFromJwt(accessTokenValue)
          if (jwtUsername && jwtUsername !== identity.loginName) {
            identityMismatch = true
          }
        }
      }

      const isLoggedOut = authMode === AUTH_MODES.LOGGED_OUT
      const needsNewTokens = !hasAccessToken || (isLoggedOut && !hasAccessToken) || identityMismatch
      const skipTokenFetch = isLoggedOut && hasAccessToken && !identityMismatch

      if (skipTokenFetch) {
        // User logged out but still has valid token - respect logout
        return response
      }

      if (needsNewTokens) {
        const authResponse = await fetchJwtTokens(identity.loginName)

        if (authResponse.ok) {
          const setCookies = authResponse.headers.getSetCookie()
          forwardAuthCookies(response, setCookies)

          // Set auth mode to SSO and clear any previous logged_out state
          response.headers.append('Set-Cookie', `${COOKIES.AUTH_MODE}=${AUTH_MODES.SSO}; Path=/; Max-Age=86400; SameSite=lax`)

          // Fetch and set user data for immediate client hydration
          const accessTokenCookie = setCookies.find(c => c.startsWith(`${COOKIES.ACCESS}=`))
          if (accessTokenCookie) {
            const userData = await fetchUserData(accessTokenCookie, requestId)
            if (userData) {
              setUserDataCookie(response, userData, requestId)
            }
          }
        } else {
          // Handle user not found / unauthorized cases from backend
          console.error(`[Middleware:${requestId}] JWT token fetch failed: ${authResponse.status}`)

          // Map HTTP status to user-friendly error message
          let errorMessage = 'Authentication failed. Please try again or contact your administrator.'
          if (authResponse.status === 404) {
            errorMessage = 'User not found. Please contact your administrator to request access.'
          } else if (authResponse.status === 401 || authResponse.status === 403) {
            errorMessage = 'You are not authorized to access this application. Please contact your administrator.'
          }

          const loginUrl = new URL('/login', request.url)
          loginUrl.searchParams.set('error', errorMessage)
          const redirectResponse = NextResponse.redirect(loginUrl)
          // Clear cookies to prevent loop
          redirectResponse.cookies.delete(COOKIES.ACCESS)
          redirectResponse.cookies.delete(COOKIES.REFRESH)
          redirectResponse.cookies.delete(COOKIES.USER_DATA)
          redirectResponse.cookies.delete(COOKIES.AUTH_MODE)
          return redirectResponse
        }
      }
    } catch (error) {
      console.error(`[Middleware:${requestId}] Taihu auth failed:`, error)
      // Always redirect to login when Taihu headers are present but invalid
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed'
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', errorMessage)
      const redirectResponse = NextResponse.redirect(loginUrl)
      // Clear cookies to prevent loop
      redirectResponse.cookies.delete(COOKIES.ACCESS)
      redirectResponse.cookies.delete(COOKIES.REFRESH)
      redirectResponse.cookies.delete(COOKIES.USER_DATA)
      redirectResponse.cookies.delete(COOKIES.AUTH_MODE)
      return redirectResponse
    }
  } else if (hasAccessToken && authMode !== AUTH_MODES.LOGGED_OUT) {
    // User has access token (either password login or SSO refresh without headers)
    // Fetch user data for the session
    try {
      const accessTokenValue = request.cookies.get(COOKIES.ACCESS)?.value
      const accessTokenCookie = `${COOKIES.ACCESS}=${accessTokenValue}`
      const userData = await fetchUserData(accessTokenCookie, requestId)
      if (userData) {
        setUserDataCookie(response, userData, requestId)
      } else {
        // Token is invalid or expired - redirect to login
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('error', 'Your session has expired. Please log in again.')
        const redirectResponse = NextResponse.redirect(loginUrl)
        // Clear cookies to prevent loop
        redirectResponse.cookies.delete(COOKIES.ACCESS)
        redirectResponse.cookies.delete(COOKIES.REFRESH)
        redirectResponse.cookies.delete(COOKIES.USER_DATA)
        redirectResponse.cookies.delete(COOKIES.AUTH_MODE)
        return redirectResponse
      }
    } catch (error) {
      console.error(`[Middleware:${requestId}] User refresh error:`, error)
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'Authentication error. Please log in again.')
      const redirectResponse = NextResponse.redirect(loginUrl)
      // Clear cookies to prevent loop
      redirectResponse.cookies.delete(COOKIES.ACCESS)
      redirectResponse.cookies.delete(COOKIES.REFRESH)
      redirectResponse.cookies.delete(COOKIES.USER_DATA)
      redirectResponse.cookies.delete(COOKIES.AUTH_MODE)
      return redirectResponse
    }
  }

  return response
}

export default middleware

export const config = {
  matcher: ['/((?!api/|_next/|_vercel/|.*\\..*).*)'],
}
