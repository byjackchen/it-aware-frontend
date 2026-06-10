import type { Metadata } from "next";
// Self-hosted via Vercel's `geist` package — `next/font/google` fetches from
// fonts.googleapis.com at build time, which fails on closed-network CI builds
// (e.g. Tencent DevCloud). The geist package bundles the same Geist Sans /
// Geist Mono files locally and exposes the same CSS variables.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Script from "next/script";
import "./globals.css";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { ThemeProvider } from '@/lib/contexts/theme-context';
import { cookies } from 'next/headers';
import { EnvBanner, ENV_BANNER_HEIGHT_PX } from '@/components/layout/EnvBanner';
import { RUNTIME_CONFIG } from '@/lib/config/runtime';

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

  // Yellow safety banner on every page for any non-prod environment.
  const itAwareEnv = RUNTIME_CONFIG.app.itAwareEnv;
  const showEnvBanner = itAwareEnv !== 'prod';

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
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased gradient-bg-animated theme-${initialTheme}`}
        style={{ '--env-banner-h': showEnvBanner ? `${ENV_BANNER_HEIGHT_PX}px` : '0px' } as React.CSSProperties}
        suppressHydrationWarning
      >
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            {showEnvBanner && <EnvBanner env={itAwareEnv} />}
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
