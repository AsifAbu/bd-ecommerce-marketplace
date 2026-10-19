import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Container } from "@/components/ui";

/**
 * Shared frame of every /admin page: section navigation (sidebar from lg, a scrolling tab row on
 * phones) and the page's <main>. The navigation only shows for a Platform Admin; each page still
 * runs its own guard.
 */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Container className="flex flex-1 flex-col gap-6 pb-10 lg:flex-row lg:gap-10 lg:pt-8">
      <Suspense fallback={<div aria-hidden="true" className="h-11 border-b border-line max-lg:-mx-4 sm:max-lg:-mx-6 lg:hidden" />}>
        <AdminNav />
      </Suspense>
      <main id="main" className="flex min-w-0 flex-1 flex-col gap-8 lg:pb-0">{children}</main>
    </Container>
  );
}
