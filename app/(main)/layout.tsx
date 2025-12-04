import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
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
      <Sidebar />
      <main className="pt-16 pl-64 min-h-screen">
        {children}
      </main>
      <ChatbotDrawer />
    </Providers>
  );
}
