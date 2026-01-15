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
function encodeForHeader(str: string, requestId: string): string {
  // Check if encoding is needed
  const check = hasNonAscii(str)
  if (check.hasNonAscii) {
    console.log(`[Middleware:${requestId}] String contains non-ASCII, encoding: index=${check.firstNonAsciiIndex}, charCode=${check.charCode}, char='${check.char}'`)
    // Use encodeURIComponent for safe header encoding
    return encodeURIComponent(str)
  }
  return str
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
  const startTime = Date.now()
  try {
    console.log(`[Middleware:${requestId}] fetchUserData: Starting, cookie length=${accessTokenCookie.length}`)
    const cookieValue = accessTokenCookie.split(';')[0]
    console.log(`[Middleware:${requestId}] fetchUserData: Cookie value (first 50 chars): ${cookieValue.substring(0, 50)}...`)

    // Check cookie value for non-ASCII
    const cookieCheck = hasNonAscii(cookieValue)
    if (cookieCheck.hasNonAscii) {
      console.log(`[Middleware:${requestId}] fetchUserData: Cookie has non-ASCII: index=${cookieCheck.firstNonAsciiIndex}, charCode=${cookieCheck.charCode}`)
    }

    console.log(`[Middleware:${requestId}] fetchUserData: Calling backend: ${BACKEND_DOMAIN}/auth/me`)
    const response = await fetch(`${BACKEND_DOMAIN}/auth/me`, {
      method: 'GET',
      headers: { 'Cookie': cookieValue },
    })

    const duration = Date.now() - startTime
    console.log(`[Middleware:${requestId}] fetchUserData: Response: status=${response.status}, duration=${duration}ms`)

    if (response.ok) {
      const userData = await response.json()
      console.log(`[Middleware:${requestId}] fetchUserData: Success, raw keys: ${Object.keys(userData).join(', ')}`)

      // Pass through backend response directly (nested format: { account, worker, permissions, groups })
      // Frontend now expects the nested format
      console.log(`[Middleware:${requestId}] fetchUserData: username=${userData.account?.username}, permissions count=${userData.permissions?.unconstrained?.length}`)
      return userData
    }

    // Log why the response was not OK
    const errorText = await response.text().catch(() => 'Failed to read response body')
    console.error(`[Middleware:${requestId}] fetchUserData: Backend returned non-OK: status=${response.status}, body=${errorText.substring(0, 200)}`)
    return null
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Middleware:${requestId}] fetchUserData: Exception after ${duration}ms:`, error)
    console.error(`[Middleware:${requestId}] fetchUserData: Error type: ${error?.constructor?.name}`)
    if (error instanceof Error) {
      console.error(`[Middleware:${requestId}] fetchUserData: Error message: ${error.message}`)
    }
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
    // Use Base64 encoding to handle Chinese characters in user data
    const jsonString = JSON.stringify(userData)
    console.log(`[Middleware:${requestId}] setUserDataCookie: JSON string length=${jsonString.length}`)

    // Check for non-ASCII in JSON
    const jsonCheck = hasNonAscii(jsonString)
    if (jsonCheck.hasNonAscii) {
      console.log(`[Middleware:${requestId}] setUserDataCookie JSON has non-ASCII: index=${jsonCheck.firstNonAsciiIndex}, charCode=${jsonCheck.charCode}, char='${jsonCheck.char}'`)
    }

    const encoded = Buffer.from(jsonString).toString('base64')
    console.log(`[Middleware:${requestId}] setUserDataCookie: Base64 encoded length=${encoded.length}`)

    // Verify base64 is ASCII-safe
    const encodedCheck = hasNonAscii(encoded)
    if (encodedCheck.hasNonAscii) {
      console.error(`[Middleware:${requestId}] UNEXPECTED: Base64 encoded string has non-ASCII!`)
    }

    response.headers.append('Set-Cookie', `${COOKIES.USER_DATA}=${encoded}; Path=/; Max-Age=30; SameSite=lax`)
    console.log(`[Middleware:${requestId}] setUserDataCookie: Cookie set successfully`)
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

  console.log(`[Middleware:${requestId}] ========== REQUEST START ==========`)
  console.log(`[Middleware:${requestId}] pathname=${pathname}, isPublicRoute=${isPublicRoute}`)

  if (shouldSkipMiddleware(pathname)) {
    console.log(`[Middleware:${requestId}] Skipping middleware for path: ${pathname}`)
    return NextResponse.next()
  }

  const hasAccessToken = request.cookies.has(COOKIES.ACCESS)
  const hasUserDataCookie = request.cookies.has(COOKIES.USER_DATA)
  const authMode = request.cookies.get(COOKIES.AUTH_MODE)?.value as AuthMode
  const taihuHeaders = extractTaihuHeaders(request)
  // Skip Taihu headers check for public routes (like /login) to allow username/password auth
  const hasTaihuHeaders = !isPublicRoute && !!taihuHeaders['x-tai-identity']

  console.log(`[Middleware:${requestId}] Cookie state:`, {
    hasAccessToken,
    authMode,
    hasUserDataCookie,
    hasTaihuHeaders,
    taihuIdentityPresent: !!taihuHeaders['x-tai-identity']
  })

  // Log all cookies for debugging
  const allCookies = request.cookies.getAll()
  console.log(`[Middleware:${requestId}] All cookies (${allCookies.length}):`, allCookies.map(c => `${c.name}=${c.value.substring(0, 20)}...`))

  // Redirect to login if not authenticated (skip for public routes)
  if (!isPublicRoute && !hasAccessToken && !hasTaihuHeaders) {
    console.log(`[Middleware:${requestId}] No access token and no Taihu headers, redirecting to login`)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect logged-out users without SSO headers to login
  if (authMode === AUTH_MODES.LOGGED_OUT && !hasTaihuHeaders) {
    console.log(`[Middleware:${requestId}] User logged out without Taihu headers, redirecting to login`)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const response = NextResponse.next()

  // Skip Taihu SSO authentication for public routes (allow username/password login)
  if (isPublicRoute) {
    console.log(`[Middleware:${requestId}] Public route, skipping auth processing`)
    return response
  }

  // Process Taihu SSO authentication
  // Skip if user explicitly logged in via username/password (password login takes precedence)
  if (hasTaihuHeaders && authMode !== AUTH_MODES.PASSWORD) {
    console.log(`[Middleware:${requestId}] Processing Taihu SSO authentication`)
    try {
      const identity = await getIdentityFromHeaders(taihuHeaders)

      console.log(`[Middleware:${requestId}] Identity retrieved: staffId=${identity.staffId}, loginName length=${identity.loginName?.length}`)

      // Check for non-ASCII in loginName
      const loginNameCheck = hasNonAscii(identity.loginName || '')
      if (loginNameCheck.hasNonAscii) {
        console.log(`[Middleware:${requestId}] loginName contains non-ASCII: index=${loginNameCheck.firstNonAsciiIndex}, charCode=${loginNameCheck.charCode}, char='${loginNameCheck.char}'`)
      }

      // Set user info headers (encode to handle non-ASCII characters)
      try {
        response.headers.set('x-user-staff-id', identity.staffId.toString())
        // Encode loginName to handle potential non-ASCII characters
        const encodedLoginName = encodeForHeader(identity.loginName, requestId)
        response.headers.set('x-user-login-name', encodedLoginName)
        console.log(`[Middleware:${requestId}] Headers set successfully, encoded loginName length=${encodedLoginName.length}`)
      } catch (headerError) {
        console.error(`[Middleware:${requestId}] Failed to set headers:`, headerError)
        console.error(`[Middleware:${requestId}] loginName value: '${identity.loginName}'`)
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
            console.log(`[Middleware:${requestId}] IDENTITY MISMATCH: Taihu=${identity.loginName}, JWT=${jwtUsername}`)
          }
        }
      }

      const isLoggedOut = authMode === AUTH_MODES.LOGGED_OUT
      const needsNewTokens = !hasAccessToken || (isLoggedOut && !hasAccessToken) || identityMismatch
      const skipTokenFetch = isLoggedOut && hasAccessToken && !identityMismatch

      console.log(`[Middleware:${requestId}] Token decision: needsNewTokens=${needsNewTokens}, skipTokenFetch=${skipTokenFetch}, identityMismatch=${identityMismatch}`)

      if (skipTokenFetch) {
        // User logged out but still has valid token - respect logout
        console.log(`[Middleware:${requestId}] Skipping token fetch (logged out with valid token)`)
        return response
      }

      if (needsNewTokens) {
        console.log(`[Middleware:${requestId}] Fetching new JWT tokens for user: ${identity.loginName}`)
        const authResponse = await fetchJwtTokens(identity.loginName)

        console.log(`[Middleware:${requestId}] JWT token response status: ${authResponse.status}`)
        if (authResponse.ok) {
          const setCookies = authResponse.headers.getSetCookie()
          console.log(`[Middleware:${requestId}] Received ${setCookies.length} Set-Cookie headers from backend`)
          forwardAuthCookies(response, setCookies)

          // Set auth mode to SSO and clear any previous logged_out state
          response.headers.append('Set-Cookie', `${COOKIES.AUTH_MODE}=${AUTH_MODES.SSO}; Path=/; Max-Age=86400; SameSite=lax`)

          // Fetch and set user data for immediate client hydration
          const accessTokenCookie = setCookies.find(c => c.startsWith(`${COOKIES.ACCESS}=`))
          console.log(`[Middleware:${requestId}] Access token cookie found in response: ${!!accessTokenCookie}`)
          if (accessTokenCookie) {
            const userData = await fetchUserData(accessTokenCookie, requestId)
            if (userData) {
              console.log(`[Middleware:${requestId}] Setting user data cookie for SSO user`)
              setUserDataCookie(response, userData, requestId)
            } else {
              console.error(`[Middleware:${requestId}] Failed to fetch user data after token acquisition`)
            }
          }
        } else {
          // Handle user not found / unauthorized cases from backend
          console.error(`[Middleware:${requestId}] JWT token fetch failed: ${authResponse.status}`)
          const errorText = await authResponse.text().catch(() => '')
          console.error(`[Middleware:${requestId}] JWT token fetch error body: ${errorText.substring(0, 200)}`)

          // Map HTTP status to user-friendly error message
          let errorMessage = 'Authentication failed. Please try again or contact your administrator.'
          if (authResponse.status === 404) {
            errorMessage = 'User not found. Please contact your administrator to request access.'
          } else if (authResponse.status === 401 || authResponse.status === 403) {
            errorMessage = 'You are not authorized to access this application. Please contact your administrator.'
          }

          const loginUrl = new URL('/login', request.url)
          loginUrl.searchParams.set('error', errorMessage)
          return NextResponse.redirect(loginUrl)
        }
      }
    } catch (error) {
      console.error(`[Middleware:${requestId}] Taihu auth failed:`, error)
      // Always redirect to login when Taihu headers are present but invalid
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed'
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', errorMessage)
      return NextResponse.redirect(loginUrl)
    }
  } else if (hasAccessToken && authMode !== AUTH_MODES.LOGGED_OUT) {
    // User has access token (either password login or SSO refresh without headers)
    // Fetch user data for the session
    const flowType = authMode === AUTH_MODES.PASSWORD ? 'Password login' : authMode === AUTH_MODES.SSO ? 'SSO' : 'Regular'
    console.log(`[Middleware:${requestId}] ${flowType} user refresh flow`)
    try {
      const accessTokenValue = request.cookies.get(COOKIES.ACCESS)?.value
      console.log(`[Middleware:${requestId}] ${flowType} user: Access token length: ${accessTokenValue?.length || 0}`)
      const accessTokenCookie = `${COOKIES.ACCESS}=${accessTokenValue}`
      const userData = await fetchUserData(accessTokenCookie, requestId)
      if (userData) {
        console.log(`[Middleware:${requestId}] ${flowType} user: Successfully fetched user data, setting cookie`)
        setUserDataCookie(response, userData, requestId)
      } else {
        // Token is invalid or expired - redirect to login
        console.error(`[Middleware:${requestId}] ${flowType} user: Failed to fetch user data (token invalid/expired), redirecting to login`)
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('error', 'Your session has expired. Please log in again.')
        return NextResponse.redirect(loginUrl)
      }
    } catch (error) {
      console.error(`[Middleware:${requestId}] ${flowType} user refresh error:`, error)
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'Authentication error. Please log in again.')
      return NextResponse.redirect(loginUrl)
    }
  } else {
    console.log(`[Middleware:${requestId}] No user data refresh needed (hasAccessToken=${hasAccessToken}, authMode=${authMode})`)
  }

  console.log(`[Middleware:${requestId}] ========== REQUEST END ==========`)
  return response
}

export default middleware

export const config = {
  matcher: ['/((?!api/|_next/|_vercel/|.*\\..*).*)'],
}
