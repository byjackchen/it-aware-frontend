/**
 * Core API client for server-side requests.
 * Handles cookies, headers, and error responses.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
    const cookieStore = await cookies();
    // Only forward app cookies to avoid non-ASCII characters in third-party cookies
    // that cause "Cannot convert argument to a ByteString" errors
    const cookieHeader = cookieStore.getAll()
        .filter(c => c.name.startsWith('it_aware_'))
        .map(c => `${c.name}=${c.value}`)
        .join('; ');

    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Cookie: cookieHeader,
            ...options?.headers,
        },
        cache: 'no-store',
    });

    if (res.status === 401) {
        redirect('/login');
    }

    if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(error.detail || `API Error: ${res.status}`);
    }

    if (res.status === 204) {
        return null as T;
    }

    return res.json();
}
