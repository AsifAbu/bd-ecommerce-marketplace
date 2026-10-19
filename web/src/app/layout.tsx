import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { TabBar } from "@/components/tab-bar";
import { TestModeBanner } from "@/components/test-mode-banner";
import { ToastProvider } from "@/components/ui";
import { CartTabBadge } from "@/features/cart/ui/cart-link";
import { CookieNotice } from "@/features/policies/ui/cookie-notice";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "All online products in one place, from shops across Bangladesh.",
};

// viewport-fit=cover lets the bottom tab bar pad for the iPhone home indicator (safe-area-inset).
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
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
