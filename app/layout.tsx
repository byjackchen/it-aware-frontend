import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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
    <html lang={locale} className={initialTheme} suppressHydrationWarning>
      <head>
        <Script id="fix-removeChild" strategy="beforeInteractive">{`
          if (typeof Node !== 'undefined') {
            var oc = Node.prototype.removeChild;
            Node.prototype.removeChild = function(c) {
              if (c.parentNode !== this) {
                if (console) console.warn('removeChild: node not a child', c);
                return c;
              }
              return oc.call(this, c);
            };
            var oi = Node.prototype.insertBefore;
            Node.prototype.insertBefore = function(n, r) {
              if (r && r.parentNode !== this) {
                if (console) console.warn('insertBefore: ref not a child', r);
                return n;
              }
              return oi.call(this, n, r);
            };
          }
        `}</Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased gradient-bg-animated theme-${initialTheme}`}
        suppressHydrationWarning
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
