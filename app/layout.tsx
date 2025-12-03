import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TopBar } from "@/components/layout/TopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { ChatbotDrawer } from "@/components/layout/ChatbotDrawer";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IT Aware",
  description: "IT Aware Platform",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get locale from cookie (via next-intl's getLocale)
  const locale = await getLocale();

  // Providing all messages to the client side
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50`}
      >
        <NextIntlClientProvider messages={messages}>
          <TopBar />
          <Sidebar />
          <main className="pt-16 pl-64 min-h-screen">
            {children}
          </main>
          <ChatbotDrawer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
