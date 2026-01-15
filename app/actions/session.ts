'use server'

import { cookies, headers } from 'next/headers'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'
import { getUserIdentity, TaihuHeaders } from '@/lib/auth/taihu'

import { logger } from '@/lib/logger'

const BACKEND_DOMAIN = RUNTIME_CONFIG.backend.domain

// generateRequestId removed, using logger.generateRequestId()

async function parseCookies(response: Response, cookieStore: Awaited<ReturnType<typeof cookies>>) {
    for (const cookieStr of response.headers.getSetCookie()) {
        const [nameValue] = cookieStr.split(';')
        const [name, value] = nameValue.split('=')
        if (name && value) {
            cookieStore.set(name.trim(), value.trim(), { path: '/', httpOnly: true, sameSite: 'lax' })
        }
    }
}

export async function login(formData: FormData) {
    const requestId = logger.generateRequestId()
    const action = 'Auth:login'
    const startTime = Date.now()

    const username = formData.get('username') as string
    const password = formData.get('password') as string
    logger.info(`Login started - username: ${username}`, { requestId, action })

    if (!username) {
        logger.info(`Login failed - username is required`, { requestId, action })
        return { error: 'Username is required' }
    }

    if (!password) {
        logger.info(`Login failed - password is required`, { requestId, action })
        return { error: 'Password is required' }
    }

    logger.info(`Calling backend: ${BACKEND_DOMAIN}/auth/session/token`, { requestId, action })

    try {
        const response = await fetch(`${BACKEND_DOMAIN}/auth/session/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'password', username, password }),
        })

        logger.info(`Backend response status: ${response.status}`, { requestId, action })

        if (!response.ok) {
            const responseText = await response.text()
            logger.info(`Login failed - status: ${response.status}, body: ${responseText.substring(0, 200)}`, { requestId, action })
            return { error: `Login failed: ${response.status} ${responseText}` }
        }

        const cookieStore = await cookies()

        // Log set-cookie headers from response
        const setCookies = response.headers.getSetCookie()
        logger.info(`Response set-cookie count: ${setCookies.length}`, { requestId, action })

        await parseCookies(response, cookieStore)

        // Set auth mode to 'password' - this prevents Taihu SSO from overriding this login
        // and indicates the user explicitly chose username/password authentication
        cookieStore.set('it_aware_auth_mode', 'password', {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 // 24 hours expiry
        })

        const duration = Date.now() - startTime
        logger.info(`Login succeeded in ${duration}ms, set it_aware_auth_mode=password`, { requestId, action })

        return { success: true }
    } catch (error) {
        const duration = Date.now() - startTime
        logger.error(`Login error after ${duration}ms`, error, { requestId, action })
        return { error: 'Internal server error' }
    }
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

export async function logout() {
    const requestId = logger.generateRequestId()
    const action = 'Auth:logout'
    const startTime = Date.now()
    logger.info(`Logout started`, { requestId, action })

    try {
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()

        logger.info(`Total cookies count: ${allCookies.length}`, { requestId, action })

        // Log each cookie and check for non-ASCII characters
        logger.info(`Cookie names: ${allCookies.map(c => c.name).join(', ')}`, { requestId, action })
        for (const cookie of allCookies) {
            const nameCheck = hasNonAscii(cookie.name)
            const valueCheck = hasNonAscii(cookie.value)
            logger.info(`Cookie '${cookie.name}': nameLen=${cookie.name.length}, valueLen=${cookie.value.length}, nameHasNonAscii=${nameCheck.hasNonAscii}, valueHasNonAscii=${valueCheck.hasNonAscii}`, { requestId, action })
            if (nameCheck.hasNonAscii) {
                logger.info(`Cookie name non-ASCII: index=${nameCheck.firstNonAsciiIndex}, charCode=${nameCheck.charCode}, char='${nameCheck.char}'`, { requestId, action })
            }
            if (valueCheck.hasNonAscii) {
                logger.info(`Cookie value non-ASCII: index=${valueCheck.firstNonAsciiIndex}, charCode=${valueCheck.charCode}, char='${valueCheck.char}'`, { requestId, action })
            }
        }

        // Only send it_aware_* cookies to backend to avoid non-ASCII character issues
        // Third-party cookies (like sensorsdata) may contain Chinese characters that break ByteString conversion
        const itAwareCookies = allCookies.filter(c => c.name.startsWith('it_aware_'))
        const cookieHeader = itAwareCookies.map(c => `${c.name}=${c.value}`).join('; ')
        logger.info(`Cookie header length: ${cookieHeader.length} (filtered to ${itAwareCookies.length} it_aware_* cookies)`, { requestId, action })

        logger.info(`Calling backend: ${BACKEND_DOMAIN}/auth/session/logout`, { requestId, action })
        await fetch(`${BACKEND_DOMAIN}/auth/session/logout`, {
            method: 'POST',
            headers: { 'Cookie': cookieHeader }
        })
        logger.info(`Backend logout call completed`, { requestId, action })

        // Delete JWT cookies
        logger.info(`Deleting JWT cookies`, { requestId, action })
        cookieStore.delete('it_aware_access')
        cookieStore.delete('it_aware_refresh')

        // Set auth mode to 'logged_out' to prevent auto-login from proxy.ts
        // This replaces the old separate logged_out, sso_user, and password_login cookies
        logger.info(`Setting auth mode to logged_out`, { requestId, action })
        cookieStore.set('it_aware_auth_mode', 'logged_out', {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 60 * 60 // 1 hour expiry
        })

        const duration = Date.now() - startTime
        logger.info(`Logout succeeded in ${duration}ms, set it_aware_auth_mode=logged_out`, { requestId, action })
        return { success: true }
    } catch (error) {
        const duration = Date.now() - startTime
        logger.error(`Logout error after ${duration}ms`, error, { requestId, action })
        return { error: 'Logout failed' }
    }
}

export async function refresh() {
    const requestId = logger.generateRequestId()
    const action = 'Auth:refresh'
    const startTime = Date.now()
    logger.info(`Refresh started`, { requestId, action })

    try {
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()

        logger.info(`Total cookies count: ${allCookies.length}`, { requestId, action })
        logger.info(`Cookie names: ${allCookies.map(c => c.name).join(', ')}`, { requestId, action })

        // Check for key cookies
        const hasAccessToken = allCookies.some(c => c.name === 'it_aware_access')
        const hasRefreshToken = allCookies.some(c => c.name === 'it_aware_refresh')
        const hasSsoUser = allCookies.some(c => c.name === 'it_aware_sso_user')
        const hasLoggedOut = allCookies.some(c => c.name === 'it_aware_logged_out')

        logger.info(`Key cookies - access: ${hasAccessToken}, refresh: ${hasRefreshToken}, ssoUser: ${hasSsoUser}, loggedOut: ${hasLoggedOut}`, { requestId, action })

        const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ')
        logger.info(`Cookie header length: ${cookieHeader.length}`, { requestId, action })

        logger.info(`Calling backend refresh endpoint: ${BACKEND_DOMAIN}/auth/session/refresh`, { requestId, action })
        const response = await fetch(`${BACKEND_DOMAIN}/auth/session/refresh`, {
            method: 'POST',
            headers: { 'Cookie': cookieHeader }
        })

        logger.info(`Backend response status: ${response.status}`, { requestId, action })

        if (!response.ok) {
            const responseText = await response.text()
            logger.info(`Refresh failed - status: ${response.status}, body: ${responseText.substring(0, 200)}`, { requestId, action })
            return { error: 'Refresh failed' }
        }

        // Log set-cookie headers from response
        const setCookies = response.headers.getSetCookie()
        logger.info(`Response set-cookie count: ${setCookies.length}`, { requestId, action })

        await parseCookies(response, cookieStore)

        const duration = Date.now() - startTime
        logger.info(`Refresh succeeded in ${duration}ms`, { requestId, action })
        return { success: true }
    } catch (error) {
        const duration = Date.now() - startTime
        logger.error(`Refresh error after ${duration}ms`, error, { requestId, action })
        return { error: 'Refresh error' }
    }
}

export async function getCurrentUser() {
    const requestId = logger.generateRequestId()
    const action = 'Auth:getCurrentUser'
    const startTime = Date.now()
    logger.info(`getCurrentUser started`, { requestId, action })

    try {
        const headerStore = await headers()

        const taihuHeaders: TaihuHeaders = {
            'x-tai-identity': headerStore.get('x-tai-identity') || undefined,
            timestamp: headerStore.get('timestamp') || undefined,
            signature: headerStore.get('signature') || undefined,
            'x-rio-seq': headerStore.get('x-rio-seq') || undefined,
        }

        logger.info(`Taihu headers present - x-tai-identity: ${!!taihuHeaders['x-tai-identity']}, timestamp: ${!!taihuHeaders.timestamp}, signature: ${!!taihuHeaders.signature}`, { requestId, action })

        const identity = await getUserIdentity(taihuHeaders)

        const duration = Date.now() - startTime
        logger.info(`Got user identity in ${duration}ms - loginName: ${identity.loginName}, staffId: ${identity.staffId}`, { requestId, action })

        return {
            success: true,
            user: { loginName: identity.loginName, staffId: identity.staffId }
        }
    } catch (error) {
        const duration = Date.now() - startTime
        logger.error(`getCurrentUser error after ${duration}ms`, error, { requestId, action })
        return { error: error instanceof Error ? error.message : 'Failed to get user identity' }
    }
}
