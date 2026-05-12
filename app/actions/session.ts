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
    logger.info(`Login started`, { requestId, action })

    if (!username) {
        logger.info(`Login failed - username is required`, { requestId, action })
        return { error: 'Username is required' }
    }

    if (!password) {
        logger.info(`Login failed - password is required`, { requestId, action })
        return { error: 'Password is required' }
    }

    try {
        const response = await fetch(`${BACKEND_DOMAIN}/auth/session/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ grant_type: 'password', username, password }),
        })

        if (!response.ok) {
            const responseText = await response.text()
            logger.info(`Login failed - status: ${response.status}`, { requestId, action })
            // Backend errors are shaped `{"detail":{"message": "...", "code": "..."}}`.
            // Surface only the human-readable message; fall back to the raw body
            // if parsing fails so we never lose information.
            let message = responseText
            try {
                const parsed = JSON.parse(responseText)
                const inner = parsed?.detail
                if (typeof inner === 'string') {
                    message = inner
                } else if (inner && typeof inner.message === 'string') {
                    message = inner.message
                }
            } catch {
                // Non-JSON body — keep the raw text.
            }
            return { error: message || `Login failed (${response.status})` }
        }

        const cookieStore = await cookies()

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
        logger.info(`Login succeeded in ${duration}ms`, { requestId, action })

        return { success: true }
    } catch (error) {
        const duration = Date.now() - startTime
        logger.error(`Login error after ${duration}ms`, error, { requestId, action })
        return { error: 'Internal server error' }
    }
}

export async function logout() {
    const requestId = logger.generateRequestId()
    const action = 'Auth:logout'
    const startTime = Date.now()
    logger.info(`Logout started`, { requestId, action })

    try {
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()

        // Only send it_aware_* cookies to backend to avoid non-ASCII character issues
        // Third-party cookies (like sensorsdata) may contain Chinese characters that break ByteString conversion
        const itAwareCookies = allCookies.filter(c => c.name.startsWith('it_aware_'))
        const cookieHeader = itAwareCookies.map(c => `${c.name}=${c.value}`).join('; ')
        await fetch(`${BACKEND_DOMAIN}/auth/session/logout`, {
            method: 'POST',
            headers: { 'Cookie': cookieHeader }
        })

        // Delete JWT cookies
        cookieStore.delete('it_aware_access')
        cookieStore.delete('it_aware_refresh')

        // Set auth mode to 'logged_out' to prevent auto-login from proxy.ts
        // This replaces the old separate logged_out, sso_user, and password_login cookies
        cookieStore.set('it_aware_auth_mode', 'logged_out', {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: 60 * 60 // 1 hour expiry
        })

        const duration = Date.now() - startTime
        logger.info(`Logout succeeded in ${duration}ms`, { requestId, action })
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

        const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ')
        const response = await fetch(`${BACKEND_DOMAIN}/auth/session/refresh`, {
            method: 'POST',
            headers: { 'Cookie': cookieHeader }
        })

        if (!response.ok) {
            logger.info(`Refresh failed - status: ${response.status}`, { requestId, action })
            return { error: 'Refresh failed' }
        }

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
    try {
        const headerStore = await headers()

        const taihuHeaders: TaihuHeaders = {
            'x-tai-identity': headerStore.get('x-tai-identity') || undefined,
            timestamp: headerStore.get('timestamp') || undefined,
            signature: headerStore.get('signature') || undefined,
            'x-rio-seq': headerStore.get('x-rio-seq') || undefined,
        }

        const identity = await getUserIdentity(taihuHeaders)

        const duration = Date.now() - startTime
        logger.info(`Got user identity in ${duration}ms`, { requestId, action })

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
