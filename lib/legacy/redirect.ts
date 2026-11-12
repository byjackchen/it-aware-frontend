/**
 * The proxy's legacy hook: an old page address answers with a redirect to its
 * new address, while LEGACY_REDIRECTS_ENABLED is on. Temporary (307) for the
 * first release, so turning the switch back off is not undone by browser
 * caches; it may become 308 once the redirects have run a release without
 * rollback (README.md).
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
    return NextResponse.redirect(target, 307);
}
