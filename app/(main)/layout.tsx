import { TopBar } from "@/components/layout/TopBar";
import { MainContent } from "@/components/layout/MainContent";
import { ChatbotDrawer } from "@/components/layout/ChatbotDrawer";
import { Providers } from "@/components/providers/Providers";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <TopBar />
      <MainContent>
        {children}
      </MainContent>
      <ChatbotDrawer />
    </Providers>
  );
}
