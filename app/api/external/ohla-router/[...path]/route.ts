import { GATEWAY, RETURNED, SENT, fromOwnPage, plainPath, signInCookie } from '@/lib/external/ohla-router';

/**
 * The framed Ohla Router page's every request, page and API, passed to the
 * backend's gateway with the person's IT-Aware sign-in (lib/external/ohla-router.ts).
 * The answer comes back as the gateway gives it, with the headers a page needs.
 */

export const dynamic = 'force-dynamic';

type Context = { params: Promise<{ path: string[] }> };

async function pass(request: Request, context: Context): Promise<Response> {
  const { path } = await context.params;
  if (!plainPath(path)) return Response.json({ error: 'Invalid path' }, { status: 400 });
  if (!fromOwnPage(request)) return Response.json({ error: 'Only from IT-Aware' }, { status: 403 });
  const cookie = await signInCookie();
  if (!cookie) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const upstream = new URL(`${GATEWAY}/${path.map(encodeURIComponent).join('/')}`);
  upstream.search = new URL(request.url).search;
  const headers: Record<string, string> = { Cookie: cookie };
  for (const name of SENT) {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  }
  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
  let answer: Response;
  try {
    answer = await fetch(upstream, { method: request.method, headers, body, cache: 'no-store' });
  } catch {
    return Response.json({ error: 'Ohla Router is unavailable' }, { status: 502 });
  }
  const returned = new Headers();
  for (const name of RETURNED) {
    const value = answer.headers.get(name);
    if (value) returned.set(name, value);
  }
  return new Response(answer.status === 304 ? null : await answer.arrayBuffer(), { status: answer.status, headers: returned });
}

export { pass as GET, pass as POST, pass as PUT, pass as DELETE };
