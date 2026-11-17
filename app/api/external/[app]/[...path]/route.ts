import { RETURNED, SENT, externalApp, fromOwnPage, gateway, plainPath, renewSignIn, signInCookie, type RenewedSignIn } from '@/lib/external/gateway';

/**
 * A framed external task's every request, page and API, passed to the backend's
 * gateway for that task with the person's IT-Aware sign-in (lib/external/gateway.ts).
 * The answer comes back as the gateway gives it, with the headers a page needs.
 */

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ app: string; path: string[] }> };

async function pass(request: Request, context: Context): Promise<Response> {
  const { app: code, path } = await context.params;
  const app = externalApp(code);
  if (!app) return Response.json({ error: 'No such external task' }, { status: 404 });
  if (!plainPath(path)) return Response.json({ error: 'Invalid path' }, { status: 400 });
  if (!fromOwnPage(request)) return Response.json({ error: 'Only from IT-Aware' }, { status: 403 });
  // An expired sign-in is renewed here, as a page load would renew it (renewSignIn).
  let renewed: RenewedSignIn | null = null;
  let cookie = await signInCookie();
  if (!cookie) {
    renewed = await renewSignIn(request);
    if (!renewed) return Response.json({ error: 'Not authenticated' }, { status: 401 });
    cookie = renewed.cookie;
  }

  const upstream = new URL(`${gateway(app)}/${path.map(encodeURIComponent).join('/')}`);
  upstream.search = new URL(request.url).search;
  const sent: Record<string, string> = {};
  for (const name of SENT) {
    const value = request.headers.get(name);
    if (value) sent[name] = value;
  }
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  const call = (signIn: string) => fetch(upstream, { method: request.method, headers: { Cookie: signIn, ...sent }, body, cache: 'no-store' });
  let answer: Response;
  try {
    answer = await call(cookie);
    // The cookie was still there but the backend no longer takes it: renew once.
    if (answer.status === 401 && !renewed && (renewed = await renewSignIn(request))) {
      answer = await call(renewed.cookie);
    }
  } catch {
    return Response.json({ error: `${app.name} is unavailable` }, { status: 502 });
  }
  const returned = new Headers();
  for (const line of renewed?.setCookies ?? []) returned.append('set-cookie', line);
  for (const name of RETURNED) {
    const value = answer.headers.get(name);
    if (value) returned.set(name, value);
  }
  return new Response(answer.status === 304 ? null : await answer.arrayBuffer(), { status: answer.status, headers: returned });
}

export { pass as GET, pass as POST, pass as PUT, pass as DELETE };
