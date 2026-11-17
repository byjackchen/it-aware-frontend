/**
 * The Ohla Router task (it-aware-backend specs/api_specs_tasks.md, "External
 * tasks"): Router's own interface, framed from IT-Aware's origin. Every request
 * the framed page makes goes to `/api/external/ohla-router/<path>`
 * (app/api/external/ohla-router/[...path]/route.ts), and on to the backend's
 * gateway, which checks the task's rule, signs a token for the person and
 * forwards to Router. Router then applies the person's own role there.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { getIdentityFromHeaders, type TaihuHeaders } from '@/lib/auth/taihu';

/** Where the framed page lives. A name one level below the prefix, not the prefix with a
 * trailing slash (which Next.js removes): Router names its scripts and API relatively. */
export const FRAME_SRC = '/api/external/ohla-router/console';

/** The backend's gateway for the task. */
export const GATEWAY = `${RUNTIME_CONFIG.backend.domain}/external/ohla-router`;

/** The person's IT-Aware sign-in, as the backend reads it; never sent on to Router. */
export async function signInCookie(): Promise<string | null> {
  const session = (await cookies()).get('it_aware_access');
  return session ? `it_aware_access=${session.value}` : null;
}

/** A sign-in renewed for this request: the cookie to call with, and the Set-Cookie lines for the browser. */
export interface RenewedSignIn {
  cookie: string;
  setCookies: string[];
}

/**
 * A fresh IT-Aware sign-in, made the way the sign-in middleware (proxy.ts) makes
 * one for a page: from the Taihu gateway's identity on this request. The framed
 * page's requests go through `/api/`, which the middleware skips, so without this
 * they would lose the sign-in when its cookie expires (an hour), while every other
 * page renews it on its next load. Null when the request carries no Taihu
 * identity, the person signed in with a password or signed out, or the gateway
 * or the backend refuses: the caller then answers 401 as before.
 */
export async function renewSignIn(request: Request): Promise<RenewedSignIn | null> {
  const mode = (await cookies()).get('it_aware_auth_mode')?.value;
  const headers: TaihuHeaders = {
    'x-tai-identity': request.headers.get('x-tai-identity') ?? undefined,
    timestamp: request.headers.get('timestamp') ?? undefined,
    signature: request.headers.get('signature') ?? undefined,
    'x-rio-seq': request.headers.get('x-rio-seq') ?? undefined,
  };
  if (!headers['x-tai-identity'] || mode === 'password' || mode === 'logged_out') return null;
  try {
    const identity = await getIdentityFromHeaders(headers);
    const answer = await fetch(`${RUNTIME_CONFIG.backend.domain}/auth/session/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'sso', username: identity.loginName, tai_identity: String(headers['x-tai-identity']) }),
      cache: 'no-store',
    });
    if (!answer.ok) return null;
    const setCookies = answer.headers.getSetCookie();
    const cookie = setCookies.map((line) => line.split(';')[0]).find((pair) => pair.startsWith('it_aware_access='));
    return cookie ? { cookie, setCookies } : null;
  } catch {
    return null;
  }
}

export type RouterState = 'ready' | 'not_configured' | 'unavailable';

/**
 * Whether the framed page can be shown: one call through the gateway before the
 * frame is drawn. An ended sign-in goes to the login page and a person without
 * the task to the no-access page, as on every task; an environment without Router
 * configured, or Router down, is said in words rather than inside the frame.
 */
export async function routerState(): Promise<RouterState> {
  const cookie = await signInCookie();
  if (!cookie) redirect('/login');
  let status: number;
  try {
    status = (await fetch(`${GATEWAY}/admin/api/session`, { headers: { Cookie: cookie }, cache: 'no-store' })).status;
  } catch {
    return 'unavailable';
  }
  if (status === 401) redirect('/login');
  if (status === 403) redirect('/access-denied');
  if (status === 503) return 'not_configured';
  return status >= 200 && status < 300 ? 'ready' : 'unavailable';
}

/** The request headers the framed page's requests carry on, and the answer headers it gets back. */
export const SENT = ['accept', 'content-type', 'if-none-match'] as const;
export const RETURNED = [
  'allow',
  'cache-control',
  'content-security-policy',
  'content-type',
  'etag',
  'referrer-policy',
  'retry-after',
  'x-content-type-options',
  'x-frame-options',
] as const;

/** Whether a path's parts are all real names: no empty part, no `.` or `..`. */
export function plainPath(parts: string[]): boolean {
  return parts.length > 0 && parts.every((part) => part !== '' && part !== '.' && part !== '..');
}

/**
 * Whether a request may change something here. Only from IT-Aware's own pages:
 * the gateway acts with the person's sign-in, so another site must not be able to
 * make their browser send a change (Router does not check this for a signed token).
 */
export function fromOwnPage(request: Request): boolean {
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  return request.headers.get('sec-fetch-site') === 'same-origin';
}
