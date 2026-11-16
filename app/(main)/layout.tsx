import { TopBar } from "@/components/layout/TopBar";
import { MainContent } from "@/components/layout/MainContent";
import { Providers } from "@/components/providers/Providers";
import { NavigationProvider } from "@/components/navigation/NavigationProvider";
import { RouteProgressBar } from "@/components/navigation/RouteProgressBar";
import { TaskOpenRecorder } from "@/components/tasks/TaskOpenRecorder";
import { getTaskHome, getTasksMine } from "@/lib/api/tasks";

/**
 * The person's tasks with their views, for the task frame's tabs, and their
 * pins. Either is null when the backend failed to answer: the frame then shows
 * the task without tabs or pin, and the page under it reports its own failure.
 */
async function loadFrame() {
  const [mine, home] = await Promise.all([
    getTasksMine().catch(() => null),
    getTaskHome().catch(() => null),
  ]);
  return {
    held: mine ? mine.tasks.map(({ task }) => task) : null,
    pinned: home ? home.pinned.map(task => task.code) : null,
  };
}

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { held, pinned } = await loadFrame();
  return (
    <Providers>
      <NavigationProvider>
        <RouteProgressBar />
        <TaskOpenRecorder />
        <TopBar />
        <MainContent held={held} pinned={pinned}>
          {children}
        </MainContent>
      </NavigationProvider>
    </Providers>
  );
}
