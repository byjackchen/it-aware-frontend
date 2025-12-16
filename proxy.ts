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
  LOGGED_OUT: 'it_aware_logged_out',
  USER_DATA: 'it_aware_user_data',
  SSO_USER: 'it_aware_sso_user',
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

      // Transform nested backend response to flat frontend User format
      // Backend returns: { account: {...}, worker: {...}, groups: [...], permissions: [...] }
      // Frontend expects: { oid, username, email, full_name, is_active, is_system_user, created_at, groups, permissions }
      const transformedUser = {
        oid: userData.account?.oid ?? '',
        username: userData.account?.username ?? '',
        email: userData.worker?.email ?? '',
        full_name: userData.worker?.full_name ?? userData.account?.username ?? '',
        is_active: userData.account?.is_active ?? false,
        is_system_user: userData.account?.is_system ?? false,
        created_at: userData.account?.created_at ?? '',
        groups: userData.groups ?? [],
        // Backend returns permissions as { unconstrained: [...], self_scoped: [...] }
        // Frontend expects a flat string array, so extract unconstrained permissions
        permissions: userData.permissions?.unconstrained ?? [],
      }

      console.log(`[Middleware:${requestId}] fetchUserData: Transformed user: username=${transformedUser.username}, groups=${transformedUser.groups?.length}, permissions=${transformedUser.permissions?.length}`)
      return transformedUser
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
  const hasLoggedOut = request.cookies.has(COOKIES.LOGGED_OUT)
  const isSSOUser = request.cookies.has(COOKIES.SSO_USER)
  const hasUserDataCookie = request.cookies.has(COOKIES.USER_DATA)
  const taihuHeaders = extractTaihuHeaders(request)
  // Skip Taihu headers check for public routes (like /login) to allow username/password auth
  const hasTaihuHeaders = !isPublicRoute && !!taihuHeaders['x-tai-identity']

  console.log(`[Middleware:${requestId}] Cookie state:`, {
    hasAccessToken,
    hasLoggedOut,
    isSSOUser,
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
  if (hasLoggedOut && !hasTaihuHeaders) {
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
  if (hasTaihuHeaders) {
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
      const needsNewTokens = !hasAccessToken || (hasLoggedOut && !hasAccessToken)
      const skipTokenFetch = hasLoggedOut && hasAccessToken

      console.log(`[Middleware:${requestId}] Token decision: needsNewTokens=${needsNewTokens}, skipTokenFetch=${skipTokenFetch}`)

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

          // Clear logged_out cookie on re-authentication
          if (hasLoggedOut) {
            console.log(`[Middleware:${requestId}] Clearing logged_out cookie`)
            response.cookies.delete(COOKIES.LOGGED_OUT)
          }

          // Fetch and set user data for immediate client hydration
          const accessTokenCookie = setCookies.find(c => c.startsWith(`${COOKIES.ACCESS}=`))
          console.log(`[Middleware:${requestId}] Access token cookie found in response: ${!!accessTokenCookie}`)
          if (accessTokenCookie) {
            const userData = await fetchUserData(accessTokenCookie, requestId)
            if (userData) {
              console.log(`[Middleware:${requestId}] Setting user data cookie for SSO user`)
              setUserDataCookie(response, userData, requestId)
              // Set SSO user identifier for persistent recognition
              response.headers.append('Set-Cookie', `${COOKIES.SSO_USER}=true; Path=/; Max-Age=86400; SameSite=lax`)
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
  } else if (isSSOUser && !hasLoggedOut) {
    // Handle SSO user page refresh - SSO headers may not be present on refresh
    console.log(`[Middleware:${requestId}] SSO user refresh flow (no Taihu headers)`)
    try {
      if (!hasAccessToken) {
        // SSO user without valid token - redirect to login to re-authenticate
        console.error(`[Middleware:${requestId}] SSO user without valid access token - redirecting to login`)
        return NextResponse.redirect(new URL('/login', request.url))
      }

      // SSO user with valid token - ensure user data is available
      console.log(`[Middleware:${requestId}] SSO user has access token, fetching user data`)
      const accessTokenValue = request.cookies.get(COOKIES.ACCESS)?.value
      console.log(`[Middleware:${requestId}] Access token length: ${accessTokenValue?.length || 0}`)
      const accessTokenCookie = `${COOKIES.ACCESS}=${accessTokenValue}`
      const userData = await fetchUserData(accessTokenCookie, requestId)
      if (userData) {
        console.log(`[Middleware:${requestId}] SSO user: Successfully fetched user data, setting cookie`)
        setUserDataCookie(response, userData, requestId)
      } else {
        console.error(`[Middleware:${requestId}] SSO user: Failed to fetch user data (returned null)`)
      }
    } catch (error) {
      console.error(`[Middleware:${requestId}] SSO user refresh error:`, error)
      // Don't redirect on failure, let the client handle it
    }
  } else if (hasAccessToken && !hasLoggedOut) {
    // For regular login (non-SSO), fetch and set user data if not already present
    // This ensures user data is available on page refresh
    console.log(`[Middleware:${requestId}] Regular user refresh flow`)
    try {
      const accessTokenValue = request.cookies.get(COOKIES.ACCESS)?.value
      console.log(`[Middleware:${requestId}] Regular user: Access token length: ${accessTokenValue?.length || 0}`)
      const accessTokenCookie = `${COOKIES.ACCESS}=${accessTokenValue}`
      const userData = await fetchUserData(accessTokenCookie, requestId)
      if (userData) {
        console.log(`[Middleware:${requestId}] Regular user: Successfully fetched user data, setting cookie`)
        setUserDataCookie(response, userData, requestId)
      } else {
        // Token is invalid or expired - redirect to login
        console.error(`[Middleware:${requestId}] Regular user: Failed to fetch user data (token invalid/expired), redirecting to login`)
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('error', 'Your session has expired. Please log in again.')
        return NextResponse.redirect(loginUrl)
      }
    } catch (error) {
      console.error(`[Middleware:${requestId}] Regular user refresh error:`, error)
      // Auth error - redirect to login
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('error', 'Authentication error. Please log in again.')
      return NextResponse.redirect(loginUrl)
    }
  } else {
    console.log(`[Middleware:${requestId}] No user data refresh needed (hasAccessToken=${hasAccessToken}, hasLoggedOut=${hasLoggedOut}, isSSOUser=${isSSOUser})`)
  }

  console.log(`[Middleware:${requestId}] ========== REQUEST END ==========`)
  return response
}

export default middleware

export const config = {
  matcher: ['/((?!api/|_next/|_vercel/|.*\\..*).*)'],
}
