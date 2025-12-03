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

    const response = NextResponse.next()

    // Check for Taihu headers and verify identity
    const taihuHeaders: TaihuHeaders = {
        'x-tai-identity': request.headers.get('x-tai-identity') || undefined,
        timestamp: request.headers.get('timestamp') || undefined,
        signature: request.headers.get('signature') || undefined,
        'x-rio-seq': request.headers.get('x-rio-seq') || undefined,
    }

    if (taihuHeaders['x-tai-identity']) {
        try {
            const identity = await getIdentityFromHeaders(taihuHeaders)
            response.headers.set('x-user-staff-id', identity.staffId.toString())
            response.headers.set('x-user-login-name', identity.loginName)

            // Check if JWT cookies already exist
            const hasAccessToken = request.cookies.has('it_aware_access')
            
            if (hasAccessToken) {
                console.log(`[Proxy] Skipping /auth/session/token call - JWT cookies already exist for user: ${identity.loginName}`)
            } else {
                // Call backend auth service to get JWT cookies
                console.log(`[Proxy] Calling backend auth service /auth/session/token for user: ${identity.loginName}`)
                
                try {
                    const authResponse = await fetch(`${AUTH_URL}/auth/session/token`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({ username: identity.loginName }),
                    })

                    if (authResponse.ok) {
                        // Forward Set-Cookie headers from backend to client
                        for (const cookieStr of authResponse.headers.getSetCookie()) {
                            response.headers.append('Set-Cookie', cookieStr)
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
        }
    }

    return response
}

export default middleware

export const config = {
    matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
}
