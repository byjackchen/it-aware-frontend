'use server'

import { cookies, headers } from 'next/headers'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'
import { getUserIdentity, TaihuHeaders } from '@/lib/auth/taihu'

const BACKEND_DOMAIN = RUNTIME_CONFIG.backend.domain

// Generate a short request ID for log correlation
function generateRequestId(): string {
    return Math.random().toString(36).substring(2, 10)
}

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
    const requestId = generateRequestId()
    const startTime = Date.now()
    
    const username = formData.get('username') as string
    console.log(`[Auth:login][${requestId}] Login started - username: ${username}`)
    
    if (!username) {
        console.log(`[Auth:login][${requestId}] Login failed - username is required`)
        return { error: 'Username is required' }
    }

    console.log(`[Auth:login][${requestId}] Calling backend: ${BACKEND_DOMAIN}/auth/session/token`)

    try {
        const response = await fetch(`${BACKEND_DOMAIN}/auth/session/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ username }),
        })

        console.log(`[Auth:login][${requestId}] Backend response status: ${response.status}`)

        if (!response.ok) {
            const responseText = await response.text()
            console.log(`[Auth:login][${requestId}] Login failed - status: ${response.status}, body: ${responseText.substring(0, 200)}`)
            return { error: `Login failed: ${response.status} ${responseText}` }
        }

        const cookieStore = await cookies()
        
        // Log set-cookie headers from response
        const setCookies = response.headers.getSetCookie()
        console.log(`[Auth:login][${requestId}] Response set-cookie count: ${setCookies.length}`)
        
        await parseCookies(response, cookieStore)
        
        // Delete logged_out cookie to allow auto-login again
        cookieStore.delete('it_aware_logged_out')
        
        const duration = Date.now() - startTime
        console.log(`[Auth:login][${requestId}] Login succeeded in ${duration}ms, deleted it_aware_logged_out cookie`)
        
        return { success: true }
    } catch (error) {
        const duration = Date.now() - startTime
        console.error(`[Auth:login][${requestId}] Login error after ${duration}ms:`, error)
        console.error(`[Auth:login][${requestId}] Error type:`, error?.constructor?.name)
        console.error(`[Auth:login][${requestId}] Error message:`, error instanceof Error ? error.message : String(error))
        if (error instanceof Error && error.stack) {
            console.error(`[Auth:login][${requestId}] Error stack:`, error.stack)
        }
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
    const requestId = generateRequestId()
    const startTime = Date.now()
    console.log(`[Auth:logout][${requestId}] Logout started`)
    
    try {
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()
        
        console.log(`[Auth:logout][${requestId}] Total cookies count: ${allCookies.length}`)
        
        // Log each cookie and check for non-ASCII characters
        console.log(`[Auth:logout][${requestId}] Cookie names: ${allCookies.map(c => c.name).join(', ')}`)
        for (const cookie of allCookies) {
            const nameCheck = hasNonAscii(cookie.name)
            const valueCheck = hasNonAscii(cookie.value)
            console.log(`[Auth:logout][${requestId}] Cookie '${cookie.name}': nameLen=${cookie.name.length}, valueLen=${cookie.value.length}, nameHasNonAscii=${nameCheck.hasNonAscii}, valueHasNonAscii=${valueCheck.hasNonAscii}`)
            if (nameCheck.hasNonAscii) {
                console.log(`[Auth:logout][${requestId}] Cookie name non-ASCII: index=${nameCheck.firstNonAsciiIndex}, charCode=${nameCheck.charCode}, char='${nameCheck.char}'`)
            }
            if (valueCheck.hasNonAscii) {
                console.log(`[Auth:logout][${requestId}] Cookie value non-ASCII: index=${valueCheck.firstNonAsciiIndex}, charCode=${valueCheck.charCode}, char='${valueCheck.char}'`)
            }
        }
        
        const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ')
        console.log(`[Auth:logout][${requestId}] Cookie header length: ${cookieHeader.length}`)
        
        // Check the entire cookie header for non-ASCII
        const headerCheck = hasNonAscii(cookieHeader)
        if (headerCheck.hasNonAscii) {
            console.log(`[Auth:logout][${requestId}] Cookie header has non-ASCII at index ${headerCheck.firstNonAsciiIndex}, charCode=${headerCheck.charCode}, char='${headerCheck.char}'`)
        }

        console.log(`[Auth:logout][${requestId}] Calling backend: ${BACKEND_DOMAIN}/auth/session/logout`)
        await fetch(`${BACKEND_DOMAIN}/auth/session/logout`, {
            method: 'POST',
            headers: { 'Cookie': cookieHeader }
        })
        console.log(`[Auth:logout][${requestId}] Backend logout call completed`)

        // Delete JWT cookies
        console.log(`[Auth:logout][${requestId}] Deleting JWT cookies`)
        cookieStore.delete('it_aware_access')
        cookieStore.delete('it_aware_refresh')
        
        // Delete SSO user identifier cookie
        console.log(`[Auth:logout][${requestId}] Deleting SSO user identifier cookie`)
        cookieStore.delete('it_aware_sso_user')
        
        // Set logged_out cookie to prevent auto-login from proxy.ts
        // This cookie will be checked by proxy.ts to skip automatic Taihu SSO login
        console.log(`[Auth:logout][${requestId}] Setting logged_out cookie`)
        cookieStore.set('it_aware_logged_out', 'true', { 
            path: '/', 
            httpOnly: true, 
            sameSite: 'lax',
            maxAge: 60 * 60 // 1 hour expiry
        })
        
        const duration = Date.now() - startTime
        console.log(`[Auth:logout][${requestId}] Logout succeeded in ${duration}ms, set it_aware_logged_out cookie`)
        return { success: true }
    } catch (error) {
        const duration = Date.now() - startTime
        console.error(`[Auth:logout][${requestId}] Logout error after ${duration}ms:`, error)
        console.error(`[Auth:logout][${requestId}] Error type:`, error?.constructor?.name)
        console.error(`[Auth:logout][${requestId}] Error message:`, error instanceof Error ? error.message : String(error))
        if (error instanceof Error && error.stack) {
            console.error(`[Auth:logout][${requestId}] Error stack:`, error.stack)
        }
        return { error: 'Logout failed' }
    }
}

export async function refresh() {
    const requestId = generateRequestId()
    const startTime = Date.now()
    console.log(`[Auth:refresh][${requestId}] Refresh started`)
    
    try {
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()
        
        console.log(`[Auth:refresh][${requestId}] Total cookies count: ${allCookies.length}`)
        console.log(`[Auth:refresh][${requestId}] Cookie names: ${allCookies.map(c => c.name).join(', ')}`)
        
        // Check for key cookies
        const hasAccessToken = allCookies.some(c => c.name === 'it_aware_access')
        const hasRefreshToken = allCookies.some(c => c.name === 'it_aware_refresh')
        const hasSsoUser = allCookies.some(c => c.name === 'it_aware_sso_user')
        const hasLoggedOut = allCookies.some(c => c.name === 'it_aware_logged_out')
        
        console.log(`[Auth:refresh][${requestId}] Key cookies - access: ${hasAccessToken}, refresh: ${hasRefreshToken}, ssoUser: ${hasSsoUser}, loggedOut: ${hasLoggedOut}`)
        
        const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ')
        console.log(`[Auth:refresh][${requestId}] Cookie header length: ${cookieHeader.length}`)

        console.log(`[Auth:refresh][${requestId}] Calling backend refresh endpoint: ${BACKEND_DOMAIN}/auth/session/refresh`)
        const response = await fetch(`${BACKEND_DOMAIN}/auth/session/refresh`, {
            method: 'POST',
            headers: { 'Cookie': cookieHeader }
        })

        console.log(`[Auth:refresh][${requestId}] Backend response status: ${response.status}`)
        
        if (!response.ok) {
            const responseText = await response.text()
            console.log(`[Auth:refresh][${requestId}] Refresh failed - status: ${response.status}, body: ${responseText.substring(0, 200)}`)
            return { error: 'Refresh failed' }
        }
        
        // Log set-cookie headers from response
        const setCookies = response.headers.getSetCookie()
        console.log(`[Auth:refresh][${requestId}] Response set-cookie count: ${setCookies.length}`)
        
        await parseCookies(response, cookieStore)
        
        const duration = Date.now() - startTime
        console.log(`[Auth:refresh][${requestId}] Refresh succeeded in ${duration}ms`)
        return { success: true }
    } catch (error) {
        const duration = Date.now() - startTime
        console.error(`[Auth:refresh][${requestId}] Refresh error after ${duration}ms:`, error)
        console.error(`[Auth:refresh][${requestId}] Error type:`, error?.constructor?.name)
        console.error(`[Auth:refresh][${requestId}] Error message:`, error instanceof Error ? error.message : String(error))
        if (error instanceof Error && error.stack) {
            console.error(`[Auth:refresh][${requestId}] Error stack:`, error.stack)
        }
        return { error: 'Refresh error' }
    }
}

export async function getCurrentUser() {
    const requestId = generateRequestId()
    const startTime = Date.now()
    console.log(`[Auth:getCurrentUser][${requestId}] getCurrentUser started`)
    
    try {
        const headerStore = await headers()
        
        const taihuHeaders: TaihuHeaders = {
            'x-tai-identity': headerStore.get('x-tai-identity') || undefined,
            timestamp: headerStore.get('timestamp') || undefined,
            signature: headerStore.get('signature') || undefined,
            'x-rio-seq': headerStore.get('x-rio-seq') || undefined,
        }

        console.log(`[Auth:getCurrentUser][${requestId}] Taihu headers present - x-tai-identity: ${!!taihuHeaders['x-tai-identity']}, timestamp: ${!!taihuHeaders.timestamp}, signature: ${!!taihuHeaders.signature}`)

        const identity = await getUserIdentity(taihuHeaders)
        
        const duration = Date.now() - startTime
        console.log(`[Auth:getCurrentUser][${requestId}] Got user identity in ${duration}ms - loginName: ${identity.loginName}, staffId: ${identity.staffId}`)
        
        return { 
            success: true, 
            user: { loginName: identity.loginName, staffId: identity.staffId }
        }
    } catch (error) {
        const duration = Date.now() - startTime
        console.error(`[Auth:getCurrentUser][${requestId}] getCurrentUser error after ${duration}ms:`, error)
        console.error(`[Auth:getCurrentUser][${requestId}] Error type:`, error?.constructor?.name)
        console.error(`[Auth:getCurrentUser][${requestId}] Error message:`, error instanceof Error ? error.message : String(error))
        return { error: error instanceof Error ? error.message : 'Failed to get user identity' }
    }
}
