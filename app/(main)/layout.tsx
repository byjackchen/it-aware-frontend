import { TopBar } from "@/components/layout/TopBar";
import { MainContent } from "@/components/layout/MainContent";
import { ChatbotDrawer } from "@/components/layout/ChatbotDrawer";
import { Providers } from "@/components/providers/Providers";
import { NavigationProvider } from "@/components/navigation/NavigationProvider";
import { RouteProgressBar } from "@/components/navigation/RouteProgressBar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <NavigationProvider>
        <RouteProgressBar />
        <TopBar />
        <MainContent>
          {children}
        </MainContent>
        <ChatbotDrawer />
      </NavigationProvider>
    </Providers>
  );
}
