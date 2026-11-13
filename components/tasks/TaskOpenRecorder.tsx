'use client';

/**
 * Tells the backend which task's page the person opened, and at which view, so
 * their home can show "recent" and View Usages can count the open. The task
 * and the view are read from the page's address; a page that is no task's is
 * not told. It is told when the task or the view changes, not on every page:
 * going from a view's list to its records and back is one open. The backend
 * keeps it only when the task is one of theirs. Renders nothing.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { taskOpened } from '@/app/actions/tasks';
import { openKey } from '@/lib/tasks/catalog';

export function TaskOpenRecorder() {
    const key = openKey(usePathname());
    useEffect(() => {
        if (!key) return;
        const [code, view] = key.split('/');
        void taskOpened(code, view);
    }, [key]);
    return null;
}
