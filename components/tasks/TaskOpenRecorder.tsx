'use client';

/**
 * Tells the backend which task's page the person opened, so their home can
 * show "recent". The task is read from the page's address; a page that is no
 * task's is not told. The backend keeps it only when the task is one of
 * theirs. Renders nothing.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { taskOpened } from '@/app/actions/tasks';
import { resolvePage } from '@/lib/tasks/catalog';

export function TaskOpenRecorder() {
    const pathname = usePathname();
    const code = resolvePage(pathname)?.task.code;
    useEffect(() => {
        if (code) void taskOpened(code);
    }, [pathname, code]);
    return null;
}
