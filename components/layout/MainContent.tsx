'use client';

import { TaskViews, type TaskFrameProps } from '@/components/tasks/TaskFrame';

/**
 * The page area under the top bar. The task's name and pin are in the top bar;
 * a task whose person has several of its views gets a slim row of tabs here.
 * There is no global sidebar.
 */
export function MainContent({ children, held }: Pick<TaskFrameProps, 'held'> & { children: React.ReactNode }) {
    return (
        <main className="relative pt-[calc(4rem+var(--env-banner-h,0px))] min-h-screen">
            <TaskViews held={held} />
            {children}
        </main>
    );
}
