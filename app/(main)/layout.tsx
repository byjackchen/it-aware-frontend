import { TopBar } from "@/components/layout/TopBar";
import { MainContent } from "@/components/layout/MainContent";
import { Providers } from "@/components/providers/Providers";
import { NavigationProvider } from "@/components/navigation/NavigationProvider";
import { RouteProgressBar } from "@/components/navigation/RouteProgressBar";
import { TaskOpenRecorder } from "@/components/tasks/TaskOpenRecorder";
import { LegacyMenuList } from "@/components/legacy/LegacyMenuList";
import { getTaskHome, getTasksMine } from "@/lib/api/tasks";

/**
 * The person's tasks with their views, for the task frame's tabs, and their
 * pins. Either is null when the backend cannot answer (its tasks switch is
 * off, or it failed): the frame then shows the task without tabs or pin.
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
          {pinned === null ? (
            // The task UI is off (or the home failed): the old-style menu from the
            // legacy registry, beside the page. Retired with lib/legacy/.
            <div className="flex">
              <LegacyMenuList />
              <div className="min-w-0 flex-1">{children}</div>
            </div>
          ) : (
            children
          )}
        </MainContent>
      </NavigationProvider>
    </Providers>
  );
}
