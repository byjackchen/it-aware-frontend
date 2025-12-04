import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIdentityFromHeaders, type TaihuHeaders } from '@/lib/auth/taihu'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'

const AUTH_URL = RUNTIME_CONFIG.auth.serviceUrl

export async function middleware(request: NextRequest) {
    // Skip static files
    const { pathname } = request.nextUrl
    if (pathname.startsWith('/_next') || pathname.startsWith('/static') || pathname === '/favicon.ico') {
        return NextResponse.next()
    }

    // Skip login page - no auth required
    if (pathname === '/login') {
        return NextResponse.next()
    }

    // Check if user is authenticated
    const hasAccessToken = request.cookies.has('it_aware_access')
    const hasLoggedOut = request.cookies.has('it_aware_logged_out')

    // Check for Taihu headers
    const taihuHeaders: TaihuHeaders = {
        'x-tai-identity': request.headers.get('x-tai-identity') || undefined,
        timestamp: request.headers.get('timestamp') || undefined,
        signature: request.headers.get('signature') || undefined,
        'x-rio-seq': request.headers.get('x-rio-seq') || undefined,
    }

    const hasTaihuHeaders = !!taihuHeaders['x-tai-identity']

    // If user has logged out and no Taihu headers (not trying to re-login via SSO), redirect to login page
    if (hasLoggedOut && !hasTaihuHeaders) {
        console.log(`[Proxy] User logged out, redirecting to login page`)
        return NextResponse.redirect(new URL('/login', request.url))
    }

    // If no JWT token and no Taihu headers, redirect to login page
    if (!hasAccessToken && !hasTaihuHeaders) {
        console.log(`[Proxy] No authentication found, redirecting to login page`)
        return NextResponse.redirect(new URL('/login', request.url))
    }

    const response = NextResponse.next()

    // Process Taihu authentication if headers are present
    if (hasTaihuHeaders) {
        try {
            const identity = await getIdentityFromHeaders(taihuHeaders)
            response.headers.set('x-user-staff-id', identity.staffId.toString())
            response.headers.set('x-user-login-name', identity.loginName)

            // Skip auto-login only if user logged out AND already has a valid JWT token
            // If user logged out but has no JWT token, they need to re-authenticate
            if (hasLoggedOut && hasAccessToken) {
                console.log(`[Proxy] Skipping auto-login - user has explicitly logged out`)
            } else if (!hasLoggedOut && hasAccessToken) {
                console.log(`[Proxy] Skipping /auth/session/token call - JWT cookies already exist for user: ${identity.loginName}`)
            } else {
                // Call backend auth service to get JWT cookies
                // This handles: 1) No JWT token, 2) User logged out and needs to re-login
                console.log(`[Proxy] Calling backend auth service /auth/session/token for user: ${identity.loginName}`)
                
                try {
                    const authResponse = await fetch(`${AUTH_URL}/auth/session/token`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({ username: identity.loginName }),
                    })

                    if (authResponse.ok) {
                        // Forward Set-Cookie headers from backend to client
                        const setCookies = authResponse.headers.getSetCookie()
                        console.log(`[Proxy] Backend Set-Cookie headers:`, setCookies)
                        for (const cookieStr of setCookies) {
                            response.headers.append('Set-Cookie', cookieStr)
                        }
                        // Clear the logged_out cookie since user is re-authenticating
                        if (hasLoggedOut) {
                            response.cookies.delete('it_aware_logged_out')
                        }
                        console.log(`[Proxy] JWT cookies set for user: ${identity.loginName}`)
                    } else {
                        console.error(`[Proxy] Auth service failed: ${authResponse.status}`)
                    }
                } catch (authError) {
                    console.error('[Proxy] Failed to call auth service:', authError)
                }
            }
        } catch (error) {
            console.error('Taihu auth failed:', error)
            // If Taihu auth fails and no JWT token, redirect to login
            if (!hasAccessToken) {
                console.log(`[Proxy] Taihu auth failed and no JWT token, redirecting to login page`)
                return NextResponse.redirect(new URL('/login', request.url))
            }
        }
    }

    return response
}

export default middleware

export const config = {
    // Exclude: /api/*, /_next/*, /_vercel/*, static files (.*\..*)
    matcher: ['/((?!api/|_next/|_vercel/|.*\..*).*)']}
