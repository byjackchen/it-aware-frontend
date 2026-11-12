'use client';

/**
 * Tells the backend which page the person opened, so their home can show
 * "recent". The backend keeps it only when the page is one of their tasks.
 * Renders nothing.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { taskOpened } from '@/app/actions/tasks';

export function TaskOpenRecorder() {
    const pathname = usePathname();
    useEffect(() => {
        void taskOpened(pathname);
    }, [pathname]);
    return null;
}
