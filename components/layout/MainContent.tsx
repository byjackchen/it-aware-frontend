'use client';

import { TaskFrame, type TaskFrameProps } from '@/components/tasks/TaskFrame';

/**
 * The page area under the top bar. A page that belongs to a task gets the task
 * frame above it (its name, pin and views); there is no global sidebar.
 */
export function MainContent({ children, held, pinned }: TaskFrameProps & { children: React.ReactNode }) {
    return (
        <main className="relative pt-[calc(4rem+var(--env-banner-h,0px))] min-h-screen">
            {/* Drawn afresh when the pins change, so a pin made elsewhere shows here. */}
            <TaskFrame key={pinned?.join(',') ?? ''} held={held} pinned={pinned} />
            {children}
        </main>
    );
}
