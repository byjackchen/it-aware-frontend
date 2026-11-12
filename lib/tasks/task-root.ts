/**
 * A multi-view task's own address (`/tasks/workers`) has no page: the proxy
 * answers it with a temporary redirect (307) to the task's first view, the
 * query string kept. A one-view task's address is its view's page, so it is
 * never redirected. Not a legacy redirect: it stays when lib/legacy/ retires.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { TASKS } from './catalog';

/** The first view's address of the multi-view task at `pathname`; null for any other address. */
export function taskRootTarget(pathname: string): string | null {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
    const task = TASKS.find(candidate => candidate.views.length > 1 && path === `/tasks/${candidate.code}`);
    return task ? task.views[0].address : null;
}

/** The redirect for a multi-view task's own address; null to let the request through. */
export function taskRootRedirect(request: NextRequest): NextResponse | null {
    const target = taskRootTarget(request.nextUrl.pathname);
    if (!target) return null;
    const url = request.nextUrl.clone(); // keeps the query string
    url.pathname = target;
    return NextResponse.redirect(url, 307);
}
