/**
 * External tasks (it-aware-backend specs/api_specs_tasks.md, "External tasks"):
 * another Ohla app's own interface, framed from IT-Aware's origin. Every request
 * the framed page makes goes to `/api/external/<task>/<path>`
 * (app/api/external/[app]/[...path]/route.ts), and on to the backend's gateway
 * for that task, which checks the task's rule, signs a token for the person and
 * forwards to the app. The app then applies the person's own role there.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';
import { getIdentityFromHeaders, type TaihuHeaders } from '@/lib/auth/taihu';

/** One app opened as an external task. */
export interface ExternalApp {
  /** The task's code, also the gateway's and the pass-through's prefix. */
  code: string;
  /** As people know it. */
  name: string;
  /** Where the framed page lives: a name one level below the prefix, not the prefix with a
   * trailing slash (which Next.js removes). The app names its scripts and API relatively. */
  entry: string;
  /** What the page asks before drawing the frame: the app's own identity endpoint, or its page. */
  probe: string;
}

/**
 * The external tasks. Router's identity endpoint is its session; the others have
 * none yet, so their page itself is asked. Knowledge and Journey serve their
 * interface at `console`, the Sidebar its configuration page at `admin` (the seam:
 * iWiki 4061914677, section 3.3).
 */
export const EXTERNAL_APPS: Record<string, ExternalApp> = {
  'ohla-router': { code: 'ohla-router', name: 'Ohla Router', entry: 'console', probe: 'admin/api/session' },
  'ohla-knowledge': { code: 'ohla-knowledge', name: 'Ohla Knowledge', entry: 'console', probe: 'console' },
  'ohla-journey': { code: 'ohla-journey', name: 'Ohla Journey', entry: 'console', probe: 'console' },
  'ohla-sidebar': { code: 'ohla-sidebar', name: 'Ohla Sidebar', entry: 'admin', probe: 'admin' },
};

/** The app of a task code, or null when it is no external task's. */
export function externalApp(code: string): ExternalApp | null {
  return Object.hasOwn(EXTERNAL_APPS, code) ? EXTERNAL_APPS[code] : null;
}

/** Where the browser frames the app's page. */
export function frameSrc(app: ExternalApp): string {
  return `/api/external/${app.code}/${app.entry}`;
}

/** The backend's gateway for the task. */
export function gateway(app: ExternalApp): string {
  return `${RUNTIME_CONFIG.backend.domain}/external/${app.code}`;
}

/** The person's IT-Aware sign-in, as the backend reads it; never sent on to the app. */
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

export type TaskState = 'ready' | 'not_configured' | 'unavailable';

/**
 * Whether the framed page can be shown: one call through the gateway before the
 * frame is drawn. An ended sign-in goes to the login page and a person without
 * the task to the no-access page, as on every task; an environment without the
 * app configured, or the app down, is said in words rather than inside the frame.
 */
export async function taskState(app: ExternalApp): Promise<TaskState> {
  const cookie = await signInCookie();
  if (!cookie) redirect('/login');
  let status: number;
  try {
    status = (await fetch(`${gateway(app)}/${app.probe}`, { headers: { Cookie: cookie }, cache: 'no-store' })).status;
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
 * make their browser send a change (an app does not check this for a signed token).
 */
export function fromOwnPage(request: Request): boolean {
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  return request.headers.get('sec-fetch-site') === 'same-origin';
}
