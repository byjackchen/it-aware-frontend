'use client';

/**
 * Tells the backend which task's page the person opened, and at which view, so
 * their home can show "recent" and View Usages can count the open. The task
 * and the view are read from the page's address; a page that is no task's is
 * not told. The backend keeps it only when the task is one of theirs. Renders
 * nothing.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { taskOpened } from '@/app/actions/tasks';
import { resolvePage } from '@/lib/tasks/catalog';

export function TaskOpenRecorder() {
    const pathname = usePathname();
    const page = resolvePage(pathname);
    const code = page?.task.code;
    const view = page?.view.slug;
    useEffect(() => {
        if (code && view) void taskOpened(code, view);
    }, [pathname, code, view]);
    return null;
}
