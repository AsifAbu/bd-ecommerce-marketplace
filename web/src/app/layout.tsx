import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { TestModeBanner } from "@/components/test-mode-banner";
import { ToastProvider } from "@/components/ui";
import { CartTabBadge } from "@/features/cart/ui/cart-link";
import { CookieNotice } from "@/features/policies/ui/cookie-notice";
import "./globals.css";

// Latin face from the npm package, served by Next with a preload and a metric-matched fallback font,
// so the swap to Instrument Sans barely moves the text. Bengali stays on the unicode-range CSS in globals.css.
const instrumentSans = localFont({
  src: "../../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2",
  weight: "400 700",
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dokan",
  description: "All online products in one place, from shops across Bangladesh.",
};

// viewport-fit=cover lets the bottom tab bar pad for the iPhone home indicator (safe-area-inset).
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrumentSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <ToastProvider>
          <Suspense fallback={null}>
            <TestModeBanner />
          </Suspense>
          <Suspense fallback={null}>
            <CookieNotice />
          </Suspense>
          <SiteHeader />
          {children}
          <SiteFooter />
          <TabBar
            cartBadge={
              <Suspense fallback={null}>
                <CartTabBadge />
              </Suspense>
            }
          />
        </ToastProvider>
      </body>
    </html>
  );
}
