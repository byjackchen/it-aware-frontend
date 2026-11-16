'use client';

/**
 * Tells the backend which task's page the person opened, and at which view, so
 * their home can show "recent" and View Usages can count the open. The task
 * and the view are read from the page's address; a page that is no task's is
 * not told. It is told when the task or the view changes, not on every page:
 * going from a view's list to its records and back is one open. The backend
 * keeps it only when the task is one of theirs. Renders nothing.
 *
 * It posts to /api/tasks/opened with a plain fetch, never a server action: a
 * server action runs through the app router's queue, and one still pending
 * when the page redirects while it loads (a refused task, an ended sign-in)
 * broke the router with React error #310.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { openKey } from '@/lib/tasks/catalog';

export function TaskOpenRecorder() {
    const key = openKey(usePathname());
    useEffect(() => {
        if (!key) return;
        const [code, view] = key.split('/');
        void fetch('/api/tasks/opened', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task: code, view }),
        }).catch(() => undefined);
    }, [key]);
    return null;
}
