import type { Metadata } from "next";
import { Suspense } from "react";
import { TestModeBanner } from "@/components/test-mode-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "All online products in one place, from shops across Bangladesh.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Suspense fallback={null}>
          <TestModeBanner />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
