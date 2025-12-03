import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getIdentityFromHeaders, type TaihuHeaders } from '@/lib/auth/taihu'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'
import createMiddleware from 'next-intl/middleware';
import { routing } from '@/i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
    // Skip if static files (handled by matcher, but good to be safe)
    if (request.nextUrl.pathname.startsWith('/_next') ||
        request.nextUrl.pathname.startsWith('/static') ||
        request.nextUrl.pathname === '/favicon.ico') {
        return NextResponse.next()
    }

    // 1. Run i18n middleware first to handle routing/redirects
    const response = intlMiddleware(request);

    // 2. Run Auth Logic
    // Check for Taihu headers
    const taihuHeaders: TaihuHeaders = {
        'x-tai-identity': request.headers.get('x-tai-identity') || undefined,
        'timestamp': request.headers.get('timestamp') || undefined,
        'signature': request.headers.get('signature') || undefined,
        'x-rio-seq': request.headers.get('x-rio-seq') || undefined,
    }

    if (taihuHeaders['x-tai-identity']) {
        try {
            const identity = await getIdentityFromHeaders(taihuHeaders)
            // Identity verified, set headers on the response
            response.headers.set('x-user-staff-id', identity.staffId.toString())
            response.headers.set('x-user-login-name', identity.loginName)
        } catch (error) {
            console.error('Taihu auth failed:', error)
        }
    }

    // Check for standard cookies if Taihu headers are missing
    const accessToken = request.cookies.get('it_aware_access')



    return response;
}

export const config = {
    // Match only internationalized pathnames
    matcher: ['/', '/(zh|en)/:path*']
};
