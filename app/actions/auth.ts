'use server'

import { cookies, headers } from 'next/headers'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'
import { getUserIdentity, TaihuHeaders } from '@/lib/auth/taihu'

const BACKEND_DOMAIN = RUNTIME_CONFIG.backend.domain

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
        const response = await fetch(`${BACKEND_DOMAIN}/auth/session/token`, {
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
    console.log('[Auth] Logout started')
    try {
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()
        
        console.log(`[Auth] Total cookies count: ${allCookies.length}`)
        
        // Log each cookie and check for non-ASCII characters
        for (const cookie of allCookies) {
            const nameCheck = hasNonAscii(cookie.name)
            const valueCheck = hasNonAscii(cookie.value)
            console.log(`[Auth] Cookie '${cookie.name}': nameLen=${cookie.name.length}, valueLen=${cookie.value.length}, nameHasNonAscii=${nameCheck.hasNonAscii}, valueHasNonAscii=${valueCheck.hasNonAscii}`)
            if (nameCheck.hasNonAscii) {
                console.log(`[Auth] Cookie name non-ASCII: index=${nameCheck.firstNonAsciiIndex}, charCode=${nameCheck.charCode}, char='${nameCheck.char}'`)
            }
            if (valueCheck.hasNonAscii) {
                console.log(`[Auth] Cookie value non-ASCII: index=${valueCheck.firstNonAsciiIndex}, charCode=${valueCheck.charCode}, char='${valueCheck.char}'`)
            }
        }
        
        const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ')
        console.log(`[Auth] Cookie header length: ${cookieHeader.length}`)
        
        // Check the entire cookie header for non-ASCII
        const headerCheck = hasNonAscii(cookieHeader)
        if (headerCheck.hasNonAscii) {
            console.log(`[Auth] Cookie header has non-ASCII at index ${headerCheck.firstNonAsciiIndex}, charCode=${headerCheck.charCode}, char='${headerCheck.char}'`)
        }

        console.log('[Auth] Calling backend logout endpoint')
        await fetch(`${BACKEND_DOMAIN}/auth/session/logout`, {
            method: 'POST',
            headers: { 'Cookie': cookieHeader }
        })
        console.log('[Auth] Backend logout call completed')

        // Delete JWT cookies
        console.log('[Auth] Deleting JWT cookies')
        cookieStore.delete('it_aware_access')
        cookieStore.delete('it_aware_refresh')
        
        // Delete SSO user identifier cookie
        console.log('[Auth] Deleting SSO user identifier cookie')
        cookieStore.delete('it_aware_sso_user')
        
        // Set logged_out cookie to prevent auto-login from proxy.ts
        // This cookie will be checked by proxy.ts to skip automatic Taihu SSO login
        console.log('[Auth] Setting logged_out cookie')
        cookieStore.set('it_aware_logged_out', 'true', { 
            path: '/', 
            httpOnly: true, 
            sameSite: 'lax',
            maxAge: 60 * 60 // 1 hour expiry
        })
        
        console.log('[Auth] User logged out successfully, set it_aware_logged_out cookie')
        return { success: true }
    } catch (error) {
        console.error('[Auth] Logout error:', error)
        console.error('[Auth] Logout error type:', error?.constructor?.name)
        console.error('[Auth] Logout error message:', error instanceof Error ? error.message : String(error))
        if (error instanceof Error && error.stack) {
            console.error('[Auth] Logout error stack:', error.stack)
        }
        return { error: 'Logout failed' }
    }
}

export async function refresh() {
    try {
        const cookieStore = await cookies()
        const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')

        const response = await fetch(`${BACKEND_DOMAIN}/auth/session/refresh`, {
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
