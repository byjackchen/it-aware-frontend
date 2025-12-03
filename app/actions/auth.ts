'use server'

import { cookies } from 'next/headers'
import { RUNTIME_CONFIG } from '@/lib/config/runtime'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
    const username = formData.get('username') as string

    if (!username) {
        return { error: 'Username is required' }
    }

    try {
        const response = await fetch(`${RUNTIME_CONFIG.auth.serviceUrl}/auth/session/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ username }),
        })

        if (!response.ok) {
            const errorText = await response.text()
            return { error: `Login failed: ${response.status} ${errorText}` }
        }

        // Forward cookies from backend to client
        const setCookieHeader = response.headers.get('set-cookie')
        if (setCookieHeader) {
            // Parse and set cookies
            // Note: This is a simplified handling. In a real app, you might want to parse multiple Set-Cookie headers more robustly.
            // However, fetch API merges multiple Set-Cookie headers into one string with comma separation, which is tricky to parse.
            // For now, we'll assume the backend sets cookies correctly and we might need a better way to forward them if they are complex.
            // Actually, Server Actions running on Node.js might not easily forward all Set-Cookie headers automatically.
            // We might need to manually parse them.

            // Let's try to just return success and let the browser handle it if we were doing client-side fetch, 
            // but this is a server action.

            // A better approach for Server Actions acting as proxy:
            const cookieStore = await cookies()

            // We need to parse the Set-Cookie header string.
            // Since 'set-cookie' can be an array in Node.js but fetch returns a combined string, it's messy.
            // But Next.js 'cookies().set()' is what we need.

            // If the backend sets cookies, we should probably read them.
            // But wait, if the backend is on localhost:8007 and we are on localhost:3000, 
            // the cookies set by 8007 won't be sent to 3000 unless we proxy or set them ourselves.

            // The user requirement says "this frontend will be logged in via SSO... calling another standalone BFF service".
            // And "prefer to use server actions for any api calls".

            // If the backend returns "Login successful" and sets cookies, we need to capture those cookies.
            // Since we can't easily parse the combined Set-Cookie string from standard fetch in all environments,
            // we might assume the tokens are NOT returned in the body (based on user description).

            // Let's try to parse the split cookies if possible, or just warn.
            // For this task, I'll assume standard cookie forwarding.

            // Actually, `response.headers.getSetCookie()` is available in newer Node.js / Next.js environments.
            const setCookies = response.headers.getSetCookie()

            for (const cookieStr of setCookies) {
                // Simple parsing: name=value; Path=/; HttpOnly...
                const [nameValue, ...options] = cookieStr.split(';')
                const [name, value] = nameValue.split('=')

                if (name && value) {
                    cookieStore.set(name.trim(), value.trim(), {
                        // We should parse options too, but for now defaults or simple forwarding:
                        path: '/',
                        httpOnly: true,
                        // secure: true, // if https
                        sameSite: 'lax',
                    })
                }
            }
        }

        return { success: true }
    } catch (error) {
        console.error('Login error:', error)
        return { error: 'Internal server error' }
    }
}

export async function logout() {
    try {
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()
        const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ')

        const response = await fetch(`${RUNTIME_CONFIG.auth.serviceUrl}/auth/session/logout`, {
            method: 'POST',
            headers: {
                'Cookie': cookieHeader
            }
        })

        // Clear cookies
        cookieStore.delete('it_aware_access')
        cookieStore.delete('it_aware_refresh')

        return { success: true }
    } catch (error) {
        console.error('Logout error:', error)
        return { error: 'Logout failed' }
    }
}

export async function refresh() {
    try {
        const cookieStore = await cookies()
        const allCookies = cookieStore.getAll()
        const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ')

        const response = await fetch(`${RUNTIME_CONFIG.auth.serviceUrl}/auth/session/refresh`, {
            method: 'POST',
            headers: {
                'Cookie': cookieHeader
            }
        })

        if (response.ok) {
            const setCookies = response.headers.getSetCookie()
            for (const cookieStr of setCookies) {
                const [nameValue] = cookieStr.split(';')
                const [name, value] = nameValue.split('=')
                if (name && value) {
                    cookieStore.set(name.trim(), value.trim(), { path: '/', httpOnly: true, sameSite: 'lax' })
                }
            }
            return { success: true }
        }
        return { error: 'Refresh failed' }
    } catch (error) {
        return { error: 'Refresh error' }
    }
}
