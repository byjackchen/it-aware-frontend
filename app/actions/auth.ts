'use server'

import { cookies, headers } from 'next/headers'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'
import { getUserIdentity, TaihuHeaders } from '@/lib/auth/taihu'

const AUTH_URL = RUNTIME_CONFIG.auth.serviceUrl

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
    const username = formData.get('username') as string
    if (!username) return { error: 'Username is required' }

    console.log(`[Auth] Calling backend auth service /auth/session/token for user: ${username}`)

    try {
        const response = await fetch(`${AUTH_URL}/auth/session/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ username }),
        })

        if (!response.ok) {
            return { error: `Login failed: ${response.status} ${await response.text()}` }
        }

        const cookieStore = await cookies()
        await parseCookies(response, cookieStore)
        
        // Delete logged_out cookie to allow auto-login again
        cookieStore.delete('it_aware_logged_out')
        console.log('[Auth] User logged in, deleted it_aware_logged_out cookie')
        
        return { success: true }
    } catch (error) {
        console.error('Login error:', error)
        return { error: 'Internal server error' }
    }
}

export async function logout() {
    try {
        const cookieStore = await cookies()
        const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')

        await fetch(`${AUTH_URL}/auth/session/logout`, {
            method: 'POST',
            headers: { 'Cookie': cookieHeader }
        })

        // Delete JWT cookies
        cookieStore.delete('it_aware_access')
        cookieStore.delete('it_aware_refresh')
        
        // Set logged_out cookie to prevent auto-login from proxy.ts
        // This cookie will be checked by proxy.ts to skip automatic Taihu SSO login
        cookieStore.set('it_aware_logged_out', 'true', { 
            path: '/', 
            httpOnly: true, 
            sameSite: 'lax',
            maxAge: 60 * 60 // 1 hour expiry
        })
        
        console.log('[Auth] User logged out, set it_aware_logged_out cookie')
        return { success: true }
    } catch (error) {
        console.error('Logout error:', error)
        return { error: 'Logout failed' }
    }
}

export async function refresh() {
    try {
        const cookieStore = await cookies()
        const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')

        const response = await fetch(`${AUTH_URL}/auth/session/refresh`, {
            method: 'POST',
            headers: { 'Cookie': cookieHeader }
        })

        if (!response.ok) return { error: 'Refresh failed' }
        
        await parseCookies(response, cookieStore)
        return { success: true }
    } catch (error) {
        return { error: 'Refresh error' }
    }
}

export async function getCurrentUser() {
    try {
        const headerStore = await headers()
        
        const taihuHeaders: TaihuHeaders = {
            'x-tai-identity': headerStore.get('x-tai-identity') || undefined,
            timestamp: headerStore.get('timestamp') || undefined,
            signature: headerStore.get('signature') || undefined,
            'x-rio-seq': headerStore.get('x-rio-seq') || undefined,
        }

        const identity = await getUserIdentity(taihuHeaders)
        return { 
            success: true, 
            user: { loginName: identity.loginName, staffId: identity.staffId }
        }
    } catch (error) {
        console.error('getCurrentUser error:', error)
        return { error: error instanceof Error ? error.message : 'Failed to get user identity' }
    }
}
