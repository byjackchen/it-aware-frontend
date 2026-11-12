import { TopBar } from "@/components/layout/TopBar";
import { MainContent } from "@/components/layout/MainContent";
import { Providers } from "@/components/providers/Providers";
import { NavigationProvider } from "@/components/navigation/NavigationProvider";
import { RouteProgressBar } from "@/components/navigation/RouteProgressBar";
import { TaskOpenRecorder } from "@/components/tasks/TaskOpenRecorder";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <NavigationProvider>
        <RouteProgressBar />
        <TaskOpenRecorder />
        <TopBar />
        <MainContent>
          {children}
        </MainContent>
      </NavigationProvider>
    </Providers>
  );
}
