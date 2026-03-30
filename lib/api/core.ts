/**
 * Core API client for server-side requests.
 * Handles cookies, headers, and error responses.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';

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
        const message = typeof error?.message === 'string'
            ? error.message
            : typeof error?.detail === 'string'
                ? error.detail
                : null;
        throw new ApiError(message || `API Error: ${res.status}`, res.status);
    }

    if (res.status === 204) {
        return null as T;
    }

    return res.json();
}
