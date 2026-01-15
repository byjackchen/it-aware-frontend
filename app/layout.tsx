import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { ThemeProvider } from '@/lib/contexts/theme-context';
import { cookies } from 'next/headers';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ohla IT-Aware",
  description: "Ohla IT-Aware Platform",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get locale from cookie (via next-intl's getLocale)
  const locale = await getLocale();

  // Get theme from cookie for initial server render
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get('it-aware-theme');
  const initialTheme = themeCookie?.value === 'light' ? 'light' : 'dark';

  // Providing all messages to the client side
  const messages = await getMessages();

  return (
    <html lang={locale} className={initialTheme}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased gradient-bg-animated theme-${initialTheme}`}
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
