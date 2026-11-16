import { TopBar } from "@/components/layout/TopBar";
import { MainContent } from "@/components/layout/MainContent";
import { Providers } from "@/components/providers/Providers";
import { NavigationProvider } from "@/components/navigation/NavigationProvider";
import { RouteProgressBar } from "@/components/navigation/RouteProgressBar";
import { TaskOpenRecorder } from "@/components/tasks/TaskOpenRecorder";
import { loadFrame } from "@/lib/tasks/frame";

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
