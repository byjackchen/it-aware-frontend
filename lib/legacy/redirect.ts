/**
 * The proxy's legacy hook: an old page address answers with a permanent
 * redirect to its new address, while LEGACY_REDIRECTS_ENABLED is on.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { fillPattern } from './build';
import { findLegacy } from './registry';
import { LEGACY_REDIRECTS_ENABLED } from './switch';

/** The redirect for an old page address; null to let the request through. */
export function legacyRedirect(request: NextRequest, enabled = LEGACY_REDIRECTS_ENABLED): NextResponse | null {
    if (!enabled) return null;
    const { pathname } = request.nextUrl;
    if (pathname === '/api' || pathname.startsWith('/api/')) return null;
    const hit = findLegacy(pathname);
    // A kept address (/, /home, /access-denied) is its own new address.
    if (!hit || hit.entry.new === hit.entry.old) return null;
    const target = request.nextUrl.clone(); // keeps the query string
    target.pathname = fillPattern(hit.entry.new, hit.values);
    // One line per redirect, to count use. Patterns only: no record IDs, no query.
    console.info(`[legacy-redirect] old=${hit.entry.old} new=${hit.entry.new}`);
    return NextResponse.redirect(target, 308);
}
